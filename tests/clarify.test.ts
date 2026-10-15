import { validSteps, promptFixture } from './helpers/gate-fixtures.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';

import { runClarify } from '../src/cli/commands/clarify.js';
import { runInit } from '../src/cli/commands/init.js';
import { runIntake } from '../src/cli/commands/intake.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { CliError, ExitCode } from '../src/errors.js';
import { parseProductConfig } from '../src/schema/config.js';
import {
  type Clarification,
  type ClarificationSteps,
  computeEntryHash,
  stepsContentHash, renderPresentation } from '../src/schema/clarification.js';

let root: string;

const completeSteps: ClarificationSteps = validSteps(['Build a habit tracker.']);
const sourcePrompt = promptFixture('Build a habit tracker.');

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'productkit-clarify-'));
  await runInit({ cwd: root, now: new Date('2026-10-12T00:00:00Z') }, createMemoryOutput());
  await runIntake(
    { cwd: root, now: new Date('2026-10-12T00:00:00Z'), text: 'Build a habit tracker.' },
    createMemoryOutput(),
  );
});

afterEach(async () => {
  await chmod(path.join(root, 'product', 'discovery'), 0o755).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
});

function buildEntry(
  steps: ClarificationSteps,
  overrides: Partial<{
    id: string;
    user_response: 'agreed' | 'disagreed' | 'partially_agreed';
    user_statement: string;
  }> = {},
) {
  const base = {
    id: overrides.id ?? 'IC-001',
    presented_statement: renderPresentation({ steps, finding_candidates: [] }, sourcePrompt),
    presented_hash: stepsContentHash(steps),
    prompt_ref: sourcePrompt.id,
    prompt_content_hash: sourcePrompt.content_hash,
    user_response: overrides.user_response ?? ('agreed' as const),
    user_statement: overrides.user_statement ?? 'yes, correct',
    checked_at: '2026-10-12T00:00:00Z',
  };
  return { ...base, entry_hash: computeEntryHash(base) };
}

async function writeClarification(clarification: Clarification): Promise<void> {
  await mkdir(path.join(root, 'product', 'discovery'), { recursive: true });
  await writeFile(
    path.join(root, 'product', 'discovery', `${clarification.id}.yaml`),
    stringifyYaml(clarification),
    'utf8',
  );
}

async function clarify(extra: Record<string, unknown> = {}) {
  const output = createMemoryOutput();
  await runClarify({ cwd: root, ...extra }, output);
  return output;
}

describe('productkit clarify — entry flow', () => {
  it('announces the instruction when no Clarification exists yet', async () => {
    const output = await clarify();
    const text = output.stdout.join('\n');
    expect(text).toContain('AI action required');
    expect(text).toContain('SKILL.md');
    expect(text).toContain('PRM-001');
  });

  it('refuses when there is no prompt yet', async () => {
    const bareRoot = await mkdtemp(path.join(tmpdir(), 'productkit-clarify-bare-'));
    await runInit({ cwd: bareRoot, now: new Date('2026-10-12T00:00:00Z') }, createMemoryOutput());
    const error = (await runClarify({ cwd: bareRoot }, createMemoryOutput()).catch(
      (caught: unknown) => caught,
    )) as CliError;
    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
    expect(error.details.join('\n')).toContain('productkit intake');
    await rm(bareRoot, { recursive: true, force: true });
  });

  it('refuses when the workspace has not been initialised', async () => {
    const bareRoot = await mkdtemp(path.join(tmpdir(), 'productkit-clarify-noinit-'));
    const error = (await runClarify({ cwd: bareRoot }, createMemoryOutput()).catch(
      (caught: unknown) => caught,
    )) as CliError;
    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
    await rm(bareRoot, { recursive: true, force: true });
  });
});

describe('productkit clarify — completion judgement', () => {
  it('confirms a clarification whose latest entry agrees and matches the current steps hash', async () => {
    await writeClarification({
      id: 'CLR-001',
      prompt_ref: 'PRM-001',
    prompt_content_hash: sourcePrompt.content_hash,
      steps: completeSteps,
      status: 'in_progress',
      interpretation_check: [buildEntry(completeSteps)],
      finding_candidates: [],
    });

    const output = await clarify();
    expect(output.stdout.join('\n')).toContain('Clarification confirmed: CLR-001');

    const config = parseProductConfig(
      await readFile(path.join(root, 'product', 'config.yaml'), 'utf8'),
    );
    expect(config.stages.discover).toBe('done');
  });

  it('reports "not yet complete" with the reason when disagreed', async () => {
    await writeClarification({
      id: 'CLR-001',
      prompt_ref: 'PRM-001',
    prompt_content_hash: sourcePrompt.content_hash,
      steps: completeSteps,
      status: 'in_progress',
      interpretation_check: [buildEntry(completeSteps, { user_response: 'disagreed' })],
      finding_candidates: [],
    });

    const output = await clarify();
    const text = output.stdout.join('\n');
    expect(text).toContain('not yet complete');
    expect(text).toContain('not "agreed"');
  });

  it('invalidates a confirmed clarification once the underlying steps change (no silent revert to confirmed)', async () => {
    const entry = buildEntry(completeSteps);
    const changedSteps: ClarificationSteps = {
      ...completeSteps,
      decomposition: [{ statement: 'added after agreement', span_refs: [] }],
    };
    await writeClarification({
      id: 'CLR-001',
      prompt_ref: 'PRM-001',
    prompt_content_hash: sourcePrompt.content_hash,
      steps: changedSteps,
      status: 'confirmed', // the file *claims* confirmed; CLI must not trust that
      interpretation_check: [entry],
      finding_candidates: [],
    });

    const output = await clarify();
    const text = output.stdout.join('\n');
    expect(text).toContain('not yet complete');
    expect(text).toContain('changed after');

    const config = parseProductConfig(
      await readFile(path.join(root, 'product', 'config.yaml'), 'utf8'),
    );
    expect(config.stages.discover).not.toBe('done');
  });

  it('detects a tampered interpretation_check entry and reports integrity violation distinctly', async () => {
    const entry = buildEntry(completeSteps);
    const tampered = { ...entry, user_statement: 'edited after the hash was computed' };
    await writeClarification({
      id: 'CLR-001',
      prompt_ref: 'PRM-001',
    prompt_content_hash: sourcePrompt.content_hash,
      steps: completeSteps,
      status: 'in_progress',
      interpretation_check: [tampered],
      finding_candidates: [],
    });

    const output = await clarify();
    const text = output.stdout.join('\n');
    expect(text).toContain('not yet complete');
    expect(text).toContain('entry_hash');
  });

  it('rejects a Clarification file that does not match the schema', async () => {
    await mkdir(path.join(root, 'product', 'discovery'), { recursive: true });
    await writeFile(
      path.join(root, 'product', 'discovery', 'CLR-001.yaml'),
      'not: [a, valid, clarification',
      'utf8',
    );
    const error = (await clarify().catch((caught: unknown) => caught)) as CliError;
    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
  });

  it('resumes from a partially completed clarification without losing finding_candidates', async () => {
    await writeClarification({
      id: 'CLR-001',
      prompt_ref: 'PRM-001',
    prompt_content_hash: sourcePrompt.content_hash,
      steps: { ...completeSteps, definition: [{ term: 'habit', meaning: 'a daily check', origin: 'ai_inferred' }] },
      status: 'in_progress',
      interpretation_check: [],
      finding_candidates: [
        { statement: 'is daily local time or UTC?', type: 'ambiguity', span_refs: [] },
      ],
    });

    const output = await clarify();
    expect(output.stdout.join('\n')).toContain('not yet complete');

    const raw = await readFile(
      path.join(root, 'product', 'discovery', 'CLR-001.yaml'),
      'utf8',
    );
    expect(raw).toContain('daily local time or UTC');
  });

  it('running clarify twice on an already-confirmed clarification reports the same result', async () => {
    await writeClarification({
      id: 'CLR-001',
      prompt_ref: 'PRM-001',
    prompt_content_hash: sourcePrompt.content_hash,
      steps: completeSteps,
      status: 'in_progress',
      interpretation_check: [buildEntry(completeSteps)],
      finding_candidates: [],
    });

    const first = await clarify();
    const second = await clarify();
    expect(first.stdout.join('\n')).toContain('Clarification confirmed');
    expect(second.stdout.join('\n')).toContain('Clarification confirmed');
  });

  it('only touches stages.discover, never another stage key or schema_version', async () => {
    const before = parseProductConfig(
      await readFile(path.join(root, 'product', 'config.yaml'), 'utf8'),
    );
    await writeClarification({
      id: 'CLR-001',
      prompt_ref: 'PRM-001',
    prompt_content_hash: sourcePrompt.content_hash,
      steps: completeSteps,
      status: 'in_progress',
      interpretation_check: [buildEntry(completeSteps)],
      finding_candidates: [],
    });
    await clarify();
    const after = parseProductConfig(
      await readFile(path.join(root, 'product', 'config.yaml'), 'utf8'),
    );
    expect(after.schema_version).toBe(before.schema_version);
    for (const stage of Object.keys(before.stages) as Array<keyof typeof before.stages>) {
      if (stage === 'discover') continue;
      expect(after.stages[stage], stage).toBe(before.stages[stage]);
    }
  });

  it('reports a write failure during stage update without corrupting config.yaml', async () => {
    await writeClarification({
      id: 'CLR-001',
      prompt_ref: 'PRM-001',
    prompt_content_hash: sourcePrompt.content_hash,
      steps: completeSteps,
      status: 'in_progress',
      interpretation_check: [buildEntry(completeSteps)],
      finding_candidates: [],
    });

    const before = await readFile(path.join(root, 'product', 'config.yaml'), 'utf8');
    await chmod(path.join(root, 'product'), 0o500);

    const error = (await clarify().catch((caught: unknown) => caught)) as CliError;

    await chmod(path.join(root, 'product'), 0o700);

    expect(error).toBeInstanceOf(CliError);
    const after = await readFile(path.join(root, 'product', 'config.yaml'), 'utf8');
    expect(after).toBe(before);
  });
});
