import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import { runInit } from '../src/cli/commands/init.js';
import { runIntake } from '../src/cli/commands/intake.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { CliError, ExitCode } from '../src/errors.js';
import { parseProductConfig } from '../src/schema/config.js';
import { promptSchema } from '../src/schema/prompt.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'productkit-intake-'));
  await runInit({ cwd: root, now: new Date('2026-10-12T00:00:00Z') }, createMemoryOutput());
});

afterEach(async () => {
  await chmod(path.join(root, 'product', 'sources'), 0o755).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
});

async function intake(extra: Record<string, unknown> = {}) {
  const output = createMemoryOutput();
  await runIntake({ cwd: root, now: new Date('2026-10-12T00:00:00Z'), ...extra }, output);
  return output;
}

describe('productkit intake', () => {
  it('saves the prompt verbatim with an id, hash and spans', async () => {
    const output = await intake({ text: 'Build a habit tracker. Remind me daily.' });
    expect(output.stdout.join('\n')).toContain('PRM-001');

    const raw = await readFile(path.join(root, 'product', 'sources', 'PRM-001.yaml'), 'utf8');
    const prompt = promptSchema.parse(parseYaml(raw));
    expect(prompt.raw_text).toBe('Build a habit tracker. Remind me daily.');
    expect(prompt.id).toBe('PRM-001');
    expect(prompt.spans.length).toBeGreaterThan(0);
  });

  it('is append-only: re-running intake creates a new id and keeps the old one', async () => {
    await intake({ text: 'First idea.' });
    await intake({ text: 'First idea, corrected.' });

    const first = await readFile(path.join(root, 'product', 'sources', 'PRM-001.yaml'), 'utf8');
    const second = await readFile(path.join(root, 'product', 'sources', 'PRM-002.yaml'), 'utf8');
    expect(parseYaml(first).raw_text).toBe('First idea.');
    expect(parseYaml(second).raw_text).toBe('First idea, corrected.');
  });

  it('only updates stages.ingest, never another stage key or schema_version', async () => {
    const before = parseProductConfig(
      await readFile(path.join(root, 'product', 'config.yaml'), 'utf8'),
    );
    await intake({ text: 'An idea.' });
    const after = parseProductConfig(
      await readFile(path.join(root, 'product', 'config.yaml'), 'utf8'),
    );

    expect(after.stages.ingest).toBe('done');
    expect(after.schema_version).toBe(before.schema_version);
    for (const stage of Object.keys(before.stages) as Array<keyof typeof before.stages>) {
      if (stage === 'ingest') continue;
      expect(after.stages[stage], stage).toBe(before.stages[stage]);
    }
  });

  it('refuses text and --file together', async () => {
    const error = (await intake({ text: 'x', file: 'y.txt' }).catch(
      (caught: unknown) => caught,
    )) as CliError;
    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
  });

  it('refuses when neither text nor --file is given', async () => {
    const error = (await intake({}).catch((caught: unknown) => caught)) as CliError;
    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
  });

  it('refuses empty prompt text', async () => {
    const error = (await intake({ text: '   ' }).catch((caught: unknown) => caught)) as CliError;
    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
  });

  it('reads the prompt from --file', async () => {
    const filePath = path.join(root, 'idea.txt');
    await writeFile(filePath, 'An idea from a file.', 'utf8');
    await intake({ file: 'idea.txt' });
    const raw = await readFile(path.join(root, 'product', 'sources', 'PRM-001.yaml'), 'utf8');
    expect(parseYaml(raw).raw_text).toBe('An idea from a file.');
  });

  it('refuses when the workspace has not been initialised', async () => {
    const bareRoot = await mkdtemp(path.join(tmpdir(), 'productkit-intake-bare-'));
    const output = createMemoryOutput();
    const error = (await runIntake({ cwd: bareRoot, text: 'x' }, output).catch(
      (caught: unknown) => caught,
    )) as CliError;
    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
    expect(error.details.join('\n')).toContain('productkit init');
    await rm(bareRoot, { recursive: true, force: true });
  });

  it('reports a write failure without corrupting the sources directory', async () => {
    const sourcesDir = path.join(root, 'product', 'sources');
    await chmod(sourcesDir, 0o500);

    const error = (await intake({ text: 'x' }).catch((caught: unknown) => caught)) as CliError;

    await chmod(sourcesDir, 0o700);

    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
    // No temp file left behind and no PRM file created.
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(sourcesDir);
    expect(entries.filter((e) => e !== 'README.md')).toEqual([]);
  });
});
