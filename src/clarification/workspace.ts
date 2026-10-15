import { closeSync, openSync, readSync, writeSync } from 'node:fs';
import { open, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';

import { parsePrompt, type Prompt } from '../schema/prompt.js';
import { CliError, ExitCode, describeCause } from '../errors.js';
import { parseProductConfig, type AttestationPolicy, type StageName, type StageStatus } from '../schema/config.js';
import { atomicReplaceIfUnchanged } from './io.js';

/** Throws a guided error if `<cwd>/product/` has not been initialised. */
export async function ensureWorkspace(productRoot: string): Promise<void> {
  try {
    await readFile(path.join(productRoot, 'config.yaml'), 'utf8');
  } catch (cause) {
    throw new CliError(`No ProductKit workspace found at ${productRoot}.`, ExitCode.USAGE_OR_IO, [
      'Run "productkit init" first.',
    ]);
  }
  try {
    await stat(path.join(productRoot, '.migration-v0-v1.lock'));
    throw new CliError('Workspace migration is in progress. Retry the command after it completes.', ExitCode.USAGE_OR_IO);
  } catch (cause) {
    if (cause instanceof CliError) throw cause;
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw new CliError(`Could not inspect migration state: ${describeCause(cause)}`, ExitCode.USAGE_OR_IO);
  }
}

/**
 * Updates exactly one stage field while preserving the other YAML values and
 * serializing against the explicit v0→v1 migration.
 */
export async function markStage(
  productRoot: string,
  stage: StageName,
  value: StageStatus,
): Promise<void> {
  const configPath = path.join(productRoot, 'config.yaml');
  const lockPath = path.join(productRoot, '.config.lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (cause) { throw new CliError(`Could not lock config.yaml for stage update: ${describeCause(cause)}`, ExitCode.USAGE_OR_IO); }
  try { await lock.writeFile(`${process.pid}\n`); await lock.sync(); }
  catch (cause) { await lock.close().catch(() => undefined); await rm(lockPath, { force: true }); throw new CliError(`Could not initialize config lock: ${describeCause(cause)}`, ExitCode.USAGE_OR_IO); }
  let text: string;
  try {
    text = await readFile(configPath, 'utf8');
  } catch (cause) {
    await lock.close().catch(() => undefined);
    await rm(lockPath, { force: true });
    throw new CliError(
      `Could not read ${configPath}: ${describeCause(cause)}`,
      ExitCode.USAGE_OR_IO,
    );
  }

  try {
    const parsed = parseProductConfig(text); // Validate known fields without discarding user extensions/comments.
    const document = parseDocument(text);
    if (!(stage in parsed.stages)) {
      throw new CliError(`Stage ${stage} is unavailable in schema_version ${parsed.schema_version}. Run "productkit migrate" to add v1 stages.`, ExitCode.USAGE_OR_IO);
    }
    document.setIn(['stages', stage], value);
    await atomicReplaceIfUnchanged(configPath, text, document.toString());
  } finally {
    await lock.close().catch(() => undefined);
    await rm(lockPath, { force: true }).catch(() => undefined);
  }
}

/** `flag` when the workspace predates the field; the gate warns in that case. */
export async function readAttestationPolicy(productRoot: string): Promise<{ policy: AttestationPolicy; declared: boolean }> {
  const parsed = parseProductConfig(await readFile(path.join(productRoot, 'config.yaml'), 'utf8'));
  return parsed.attestation ? { policy: parsed.attestation, declared: true } : { policy: 'flag', declared: false };
}

/**
 * Reads one line from the controlling terminal, not from stdin. A CLI run by
 * an agent has no controlling terminal, so this is the one input path an
 * agent cannot supply on the user's behalf. It is not authentication — it is
 * separation: whoever is sitting at the terminal typed it.
 */
export async function readStatementFromTerminal(promptText: string): Promise<string> {
  let fd: number;
  try {
    fd = openSync('/dev/tty', 'r+');
  } catch {
    throw new CliError('No terminal is attached; a user statement must be typed by a person.', ExitCode.USAGE_OR_IO, [
      'Run this exact command yourself in a terminal and type the statement when asked.',
      'Or set `attestation: flag` in product/config.yaml to accept --user-statement from anyone; every validation report will then carry a warning.',
    ]);
  }
  try {
    writeSync(fd, promptText);
    const chunks: Buffer[] = [];
    const buffer = Buffer.alloc(1);
    for (;;) {
      const n = readSync(fd, buffer, 0, 1, null);
      if (n === 0 || buffer[0] === 0x0a) break;
      chunks.push(Buffer.from(buffer));
    }
    return Buffer.concat(chunks).toString('utf8').replace(/\r$/, '');
  } finally {
    closeSync(fd);
  }
}

/** Reads the actual original, never a synthetic source inferred from a downstream record. */
export async function readSourcePrompt(productRoot: string, id: string): Promise<Prompt | undefined> {
  if (!/^PRM-\d{3,}$/.test(id)) throw new CliError('Invalid Prompt ID.', ExitCode.USAGE_OR_IO);
  const file = path.join(productRoot, 'sources', `${id}.yaml`);
  try {
    const prompt = parsePrompt(await readFile(file, 'utf8'));
    if (prompt.id !== id) throw new Error('Prompt ID does not match its file.');
    return prompt;
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new CliError(`Could not validate ${file}: ${describeCause(cause)}`, ExitCode.USAGE_OR_IO);
  }
}
