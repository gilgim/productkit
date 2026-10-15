import { createHash, randomBytes } from 'node:crypto';
import { open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { CliError, ExitCode, describeCause } from '../errors.js';
import { atomicCreateFile, atomicReplaceIfUnchanged } from './io.js';
import { parseProductConfig } from '../schema/config.js';
const JOURNAL_NAME = '.migration-v0-v1.json';
const LOCK_NAME = '.migration-v0-v1.lock';
const BACKUP_NAME = 'config.yaml.v0.bak';
const digest = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const journalSchema = (value) => {
    if (!value || typeof value !== 'object')
        throw new CliError('Migration journal is invalid.', ExitCode.USAGE_OR_IO);
    const j = value;
    if (j.schema_version !== 1 || typeof j.migration_id !== 'string' || !/^[0-9a-f]{64}$/.test(j.source_hash ?? '') || !/^[0-9a-f]{64}$/.test(j.target_hash ?? '') || !/^[0-9a-f]{64}$/.test(j.backup_hash ?? '') || !['prepared', 'committed', 'rolled_back'].includes(j.state ?? ''))
        throw new CliError('Migration journal is invalid.', ExitCode.USAGE_OR_IO);
    return j;
};
async function maybeRead(file) {
    try {
        return await readFile(file, 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return undefined;
        throw error;
    }
}
function targetConfig(source) {
    const document = parseDocument(source, { uniqueKeys: true });
    if (document.errors.length)
        throw new CliError(`Config YAML is invalid: ${document.errors.map((e) => e.message).join('; ')}`, ExitCode.USAGE_OR_IO);
    const config = parseProductConfig(source);
    if (config.schema_version !== 0)
        throw new CliError('Only schema_version 0 can be migrated to v1.', ExitCode.USAGE_OR_IO);
    const stages = document.get('stages', true);
    if (!stages || typeof stages !== 'object' || Array.isArray(stages))
        throw new CliError('Config stages must be a mapping.', ExitCode.USAGE_OR_IO);
    if (document.getIn(['stages', 'atomic_modeling']) !== undefined || document.getIn(['stages', 'graph_analysis']) !== undefined) {
        throw new CliError('A v0 stage extension conflicts with a v1 stage key; no data was changed.', ExitCode.USAGE_OR_IO);
    }
    document.set('schema_version', 1);
    document.setIn(['stages', 'atomic_modeling'], 'not_started');
    document.setIn(['stages', 'graph_analysis'], 'not_started');
    return document.toString();
}
async function fsyncDirectory(directory) {
    const handle = await open(directory, 'r');
    try {
        await handle.sync();
    }
    finally {
        await handle.close();
    }
}
async function writeTemp(target, contents) {
    const temp = path.join(path.dirname(target), `.${path.basename(target)}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`);
    const handle = await open(temp, 'wx', 0o600);
    try {
        await handle.writeFile(contents, 'utf8');
        await handle.sync();
    }
    catch (error) {
        await handle.close().catch(() => undefined);
        await rm(temp, { force: true });
        throw error;
    }
    await handle.close();
    return temp;
}
function processAlive(pid) {
    if (!Number.isInteger(pid) || pid < 1)
        return false;
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error.code === 'EPERM';
    }
}
async function acquireLock(productRoot, resume) {
    const lockPath = path.join(productRoot, LOCK_NAME);
    const configLockPath = path.join(productRoot, '.config.lock');
    if (resume) {
        const oldLock = await maybeRead(lockPath);
        if (oldLock !== undefined) {
            const pid = Number(oldLock.split(/\s/)[0]);
            const journalText = await maybeRead(path.join(productRoot, JOURNAL_NAME));
            if (processAlive(pid))
                throw new CliError(`Migration lock is held by live process ${pid}.`, ExitCode.USAGE_OR_IO);
            if (!journalText) {
                const current = await maybeRead(path.join(productRoot, 'config.yaml'));
                const backup = await maybeRead(path.join(productRoot, BACKUP_NAME));
                if (current === undefined || backup === undefined || digest(current) !== digest(backup))
                    throw new CliError('Stale migration lock has no recoverable journal/backup pair; inspect files before recovery.', ExitCode.USAGE_OR_IO);
            }
            else
                journalSchema(JSON.parse(journalText));
            await rm(lockPath);
        }
        const oldConfigLock = await maybeRead(configLockPath);
        if (oldConfigLock !== undefined) {
            const pid = Number(oldConfigLock.split(/\s/)[0]);
            if (processAlive(pid))
                throw new CliError(`Config lock is held by live process ${pid}.`, ExitCode.USAGE_OR_IO);
            await rm(configLockPath);
        }
    }
    let handle;
    try {
        handle = await open(lockPath, 'wx', 0o600);
    }
    catch (error) {
        if (error.code === 'EEXIST')
            throw new CliError('Migration is locked by another process.', ExitCode.USAGE_OR_IO);
        throw new CliError(`Could not create migration lock: ${describeCause(error)}`, ExitCode.USAGE_OR_IO);
    }
    await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`);
    await handle.sync();
    let configLock;
    try {
        configLock = await open(configLockPath, 'wx', 0o600);
        await configLock.writeFile(`${process.pid}\n`);
        await configLock.sync();
    }
    catch (error) {
        await handle.close().catch(() => undefined);
        await rm(lockPath, { force: true });
        await configLock?.close().catch(() => undefined);
        throw new CliError(`Could not acquire config migration lock: ${describeCause(error)}`, ExitCode.USAGE_OR_IO);
    }
    let preserve = false;
    return {
        close: async () => { await configLock.close().catch(() => undefined); await handle.close().catch(() => undefined); if (!preserve) {
            await rm(configLockPath, { force: true });
            await rm(lockPath, { force: true });
        } },
        interrupt: () => { preserve = true; },
    };
}
async function readJournal(file) {
    const text = await maybeRead(file);
    if (!text)
        return undefined;
    try {
        return journalSchema(JSON.parse(text));
    }
    catch (error) {
        if (error instanceof CliError)
            throw error;
        throw new CliError(`Could not parse migration journal: ${describeCause(error)}`, ExitCode.USAGE_OR_IO);
    }
}
async function writeJournal(file, journal) {
    const text = JSON.stringify(journal, null, 2) + '\n';
    const previous = await maybeRead(file);
    if (previous === undefined) {
        if (!(await atomicCreateFile(file, text)))
            throw new CliError('Migration journal appeared concurrently.', ExitCode.USAGE_OR_IO);
    }
    else
        await atomicReplaceIfUnchanged(file, previous, text);
    await fsyncDirectory(path.dirname(file));
}
async function checkpoint(options, current, lock) {
    if (options.interruptAt === current) {
        lock.interrupt();
        throw new Error(`Simulated process interruption after ${current}.`);
    }
}
function failIo(options, point) {
    if (options.failAt === point)
        throw new Error(`Injected I/O failure at ${point}.`);
}
export async function migrateWorkspace(productRoot, options = {}) {
    const configPath = path.join(productRoot, 'config.yaml');
    const backupPath = path.join(productRoot, BACKUP_NAME);
    const journalPath = path.join(productRoot, JOURNAL_NAME);
    if (options.dryRun && (options.resume || options.rollback))
        throw new CliError('--dry-run cannot be combined with --resume/--rollback.', ExitCode.USAGE_OR_IO);
    if (options.resume && options.rollback)
        throw new CliError('--resume and --rollback are mutually exclusive.', ExitCode.USAGE_OR_IO);
    if (options.dryRun) {
        const source = await readFile(configPath, 'utf8');
        const target = targetConfig(source);
        return { state: 'dry_run', source_hash: digest(source), target_hash: digest(target), backup_path: backupPath, plan: ['preserve all current YAML keys/comments', 'set schema_version=1', 'append atomic_modeling=not_started', 'append graph_analysis=not_started', 'write verified v0 backup and migration journal'] };
    }
    const currentText = await readFile(configPath, 'utf8');
    const currentConfig = parseProductConfig(currentText);
    if (options.rollback)
        return rollbackWorkspace(productRoot);
    if (currentConfig.schema_version === 1 && !options.resume)
        return { state: 'already_current', backup_path: backupPath };
    const lock = await acquireLock(productRoot, options.resume ?? false);
    let activeTemp;
    try {
        const sourceText = await readFile(configPath, 'utf8');
        const existingJournal = await readJournal(journalPath);
        let journal;
        let targetText;
        if (options.resume) {
            if (!existingJournal) {
                const backup = await readFile(backupPath, 'utf8');
                if (digest(backup) !== digest(sourceText))
                    throw new CliError('--resume has no journal and backup does not match current source.', ExitCode.USAGE_OR_IO);
                targetText = targetConfig(sourceText);
                journal = { schema_version: 1, migration_id: `MIG-${digest(sourceText).slice(0, 16)}`, source_hash: digest(sourceText), target_hash: digest(targetText), backup_hash: digest(backup), state: 'prepared' };
                await writeJournal(journalPath, journal);
            }
            else {
                journal = existingJournal;
                const backup = await readFile(backupPath, 'utf8');
                if (digest(backup) !== journal.backup_hash || journal.backup_hash !== journal.source_hash)
                    throw new CliError('Backup hash does not match migration journal.', ExitCode.USAGE_OR_IO);
                if (digest(sourceText) === journal.target_hash) {
                    if (journal.state !== 'committed')
                        await writeJournal(journalPath, { ...journal, state: 'committed' });
                    return { state: 'resumed', source_hash: journal.source_hash, target_hash: journal.target_hash, backup_path: backupPath };
                }
                if (digest(sourceText) !== journal.source_hash)
                    throw new CliError('Current config was modified outside the migration; resume stopped without overwriting it.', ExitCode.USAGE_OR_IO);
                targetText = targetConfig(sourceText);
                if (digest(targetText) !== journal.target_hash)
                    throw new CliError('Recomputed migration target does not match the journal.', ExitCode.USAGE_OR_IO);
            }
        }
        else {
            if (existingJournal)
                throw new CliError('Migration journal already exists; use --resume or inspect the recorded state.', ExitCode.USAGE_OR_IO);
            targetText = targetConfig(sourceText);
            const sourceHash = digest(sourceText);
            const existingBackup = await maybeRead(backupPath);
            if (existingBackup !== undefined && digest(existingBackup) !== sourceHash)
                throw new CliError('Existing backup differs from current v0 config; it was preserved.', ExitCode.USAGE_OR_IO);
            failIo(options, 'backup_publish');
            if (existingBackup === undefined && !(await atomicCreateFile(backupPath, sourceText))) {
                const raced = await readFile(backupPath, 'utf8');
                if (digest(raced) !== sourceHash)
                    throw new CliError('A different backup appeared during migration; it was preserved.', ExitCode.USAGE_OR_IO);
            }
            await fsyncDirectory(productRoot);
            await checkpoint(options, 'backup_published', lock);
            journal = { schema_version: 1, migration_id: `MIG-${sourceHash.slice(0, 16)}`, source_hash: sourceHash, target_hash: digest(targetText), backup_hash: sourceHash, state: 'prepared' };
            failIo(options, 'journal_prepare');
            await writeJournal(journalPath, journal);
            await checkpoint(options, 'journal_prepared', lock);
        }
        failIo(options, 'target_write');
        const temp = await writeTemp(configPath, targetText);
        activeTemp = temp;
        await checkpoint(options, 'target_written', lock);
        const reread = await readFile(configPath, 'utf8');
        if (digest(reread) !== journal.source_hash) {
            await rm(temp, { force: true });
            throw new CliError('Config changed after migration preflight; no replacement was made.', ExitCode.USAGE_OR_IO);
        }
        failIo(options, 'config_replace');
        await rename(temp, configPath);
        activeTemp = undefined;
        await fsyncDirectory(productRoot);
        await checkpoint(options, 'config_replaced', lock);
        failIo(options, 'journal_commit');
        await writeJournal(journalPath, { ...journal, state: 'committed' });
        await checkpoint(options, 'journal_committed', lock);
        parseProductConfig(await readFile(configPath, 'utf8'));
        return { state: options.resume ? 'resumed' : 'committed', source_hash: journal.source_hash, target_hash: journal.target_hash, backup_path: backupPath };
    }
    catch (error) {
        if (String(error).startsWith('Error: Simulated process interruption'))
            lock.interrupt();
        else if (activeTemp)
            await rm(activeTemp, { force: true }).catch(() => undefined);
        if (error instanceof CliError)
            throw error;
        throw new CliError(`Migration failed: ${describeCause(error)}`, ExitCode.USAGE_OR_IO);
    }
    finally {
        await lock.close();
    }
}
async function rollbackWorkspace(productRoot) {
    const lock = await acquireLock(productRoot, true);
    try {
        const journalPath = path.join(productRoot, JOURNAL_NAME);
        const backupPath = path.join(productRoot, BACKUP_NAME);
        const journal = await readJournal(journalPath);
        if (!journal)
            throw new CliError('--rollback requires a valid migration journal.', ExitCode.USAGE_OR_IO);
        const currentText = await readFile(path.join(productRoot, 'config.yaml'), 'utf8');
        const currentHash = digest(currentText);
        if (currentHash === journal.source_hash) {
            if (journal.state !== 'rolled_back')
                await writeJournal(journalPath, { ...journal, state: 'rolled_back' });
            return { state: 'already_rolled_back', source_hash: journal.source_hash, target_hash: journal.target_hash, backup_path: backupPath };
        }
        if (journal.state === 'rolled_back')
            throw new CliError('Journal says rolled_back but config does not match the v0 source hash.', ExitCode.USAGE_OR_IO);
        if (currentHash !== journal.target_hash)
            throw new CliError('Config has user changes after migration; rollback refused and all files were preserved.', ExitCode.USAGE_OR_IO);
        const backup = await readFile(backupPath, 'utf8');
        if (digest(backup) !== journal.backup_hash)
            throw new CliError('Backup hash mismatch; rollback refused.', ExitCode.USAGE_OR_IO);
        const temp = await writeTemp(path.join(productRoot, 'config.yaml'), backup);
        await rename(temp, path.join(productRoot, 'config.yaml'));
        await fsyncDirectory(productRoot);
        await writeJournal(journalPath, { ...journal, state: 'rolled_back' });
        return { state: 'rolled_back', source_hash: journal.source_hash, target_hash: journal.target_hash, backup_path: backupPath };
    }
    finally {
        await lock.close();
    }
}
//# sourceMappingURL=migration.js.map