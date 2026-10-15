import { randomBytes } from 'node:crypto';
import { link, open, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CliError, describeCause } from '../errors.js';
/**
 * Writes via a temp file in the same directory, then rename() into place.
 * rename() is atomic on the same filesystem, so a crash mid-write never
 * leaves a half-written file at the target path — the target is either the
 * old content or the new content, never a partial one.
 */
export async function atomicWriteFile(targetPath, contents, options) {
    if (!options.overwrite && (await pathExists(targetPath))) {
        throw new CliError(`${targetPath} already exists`);
    }
    const dir = path.dirname(targetPath);
    const tmpPath = path.join(dir, `.${path.basename(targetPath)}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`);
    try {
        await writeFile(tmpPath, contents, 'utf8');
        await rename(tmpPath, targetPath);
    }
    catch (cause) {
        await rm(tmpPath, { force: true });
        throw new CliError(`Could not write ${targetPath}: ${describeCause(cause)}`);
    }
}
/** Atomically creates a file without replacing an existing path (hard-link publish). */
export async function atomicCreateFile(targetPath, contents) {
    const dir = path.dirname(targetPath);
    const tmpPath = path.join(dir, `.${path.basename(targetPath)}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`);
    let handle;
    try {
        handle = await open(tmpPath, 'wx', 0o600);
        await handle.writeFile(contents, 'utf8');
        await handle.sync();
        await handle.close();
        handle = undefined;
        await link(tmpPath, targetPath);
        await unlink(tmpPath);
        return true;
    }
    catch (cause) {
        await handle?.close().catch(() => undefined);
        await rm(tmpPath, { force: true }).catch(() => undefined);
        if (cause.code === 'EEXIST')
            return false;
        throw new CliError(`Could not atomically create ${targetPath}: ${describeCause(cause)}`);
    }
}
/** Writes a temporary file then replaces target only if its bytes still match the read snapshot. */
export async function atomicReplaceIfUnchanged(targetPath, expectedText, contents) {
    const dir = path.dirname(targetPath);
    const tmpPath = path.join(dir, `.${path.basename(targetPath)}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`);
    try {
        const handle = await open(tmpPath, 'wx', 0o600);
        try {
            await handle.writeFile(contents, 'utf8');
            await handle.sync();
        }
        finally {
            await handle.close();
        }
        const current = await (await import('node:fs/promises')).readFile(targetPath, 'utf8');
        if (current !== expectedText)
            throw new CliError(`Concurrent modification detected for ${targetPath}.`);
        await rename(tmpPath, targetPath);
    }
    catch (cause) {
        await rm(tmpPath, { force: true }).catch(() => undefined);
        if (cause instanceof CliError)
            throw cause;
        throw new CliError(`Could not atomically replace ${targetPath}: ${describeCause(cause)}`);
    }
}
async function pathExists(target) {
    try {
        await stat(target);
        return true;
    }
    catch {
        return false;
    }
}
async function listYamlIds(dir, prefix) {
    let entries;
    try {
        entries = await readdir(dir);
    }
    catch (cause) {
        const code = cause.code;
        if (code === 'ENOENT')
            return [];
        throw new CliError(`Could not read ${dir}: ${describeCause(cause)}`);
    }
    const pattern = new RegExp(`^${prefix}-(\\d+)\\.yaml$`);
    const ids = [];
    for (const entry of entries) {
        const match = pattern.exec(entry);
        if (match?.[1] !== undefined)
            ids.push(Number(match[1]));
    }
    return ids;
}
/** Next free `<prefix>-NNN` id in `dir`, starting at 001. */
export async function nextSequentialId(dir, prefix) {
    const ids = await listYamlIds(dir, prefix);
    const max = ids.length > 0 ? Math.max(...ids) : 0;
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
/** Highest existing `<prefix>-NNN` id in `dir`, or undefined if none exist. */
export async function latestId(dir, prefix) {
    const ids = await listYamlIds(dir, prefix);
    if (ids.length === 0)
        return undefined;
    return `${prefix}-${String(Math.max(...ids)).padStart(3, '0')}`;
}
//# sourceMappingURL=io.js.map