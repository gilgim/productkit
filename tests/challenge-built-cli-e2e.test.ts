import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { runInit } from '../src/cli/commands/init.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { challengeAreas } from '../src/schema/challenge.js';
import { stringify } from 'yaml';
import { promptFixture, confirmedFixture, groupFixture } from './helpers/gate-fixtures.js';

let root = '';
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });
function cli(args: string[]) { return spawnSync(process.execPath, [path.resolve('dist/cli/bin.js'), ...args], { cwd: root, encoding: 'utf8' }); }

describe('built CLI Challenge E2E', () => {
  it('requires all review areas and completes coverage without claiming semantic correctness', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'productkit-built-challenge-'));
    await runInit({ cwd: root, now: new Date('2026-10-13T00:00:00Z') }, createMemoryOutput());
    const product = path.join(root, 'product'); const prompt = promptFixture(); const clarification = confirmedFixture(undefined, prompt); const group = groupFixture(clarification.steps);
    await writeFile(path.join(product, 'sources', `${prompt.id}.yaml`), stringify(prompt));
    await writeFile(path.join(product, 'discovery', `${clarification.id}.yaml`), stringify(clarification));
    await writeFile(path.join(product, 'nodes', `${group.id}.yaml`), stringify(group));
    const start = cli(['challenge', 'review-start']); expect(start.status).toBe(0);
    const id = start.stdout.match(/Review (CHL-[0-9a-f]{16})/)?.[1]; expect(id).toBeTruthy();
    const blocked = cli(['challenge', 'review-complete', id!]); expect(blocked.status).toBe(1);
    for (const area of challengeAreas) { const result = cli(['challenge', 'review-area', id!, area, '--status', 'reviewed']); expect(result.status, `${area}: ${result.stdout}\n${result.stderr}`).toBe(0); }
    const completed = cli(['challenge', 'review-complete', id!]); expect(completed.status).toBe(0);
    expect(completed.stdout).toContain('COMPLETE coverage');
    expect(completed.stdout).toContain('no Finding was resolved');
    const validated = cli(['challenge', 'review-validate', '--review', id!]);
    expect(validated.status).toBe(0);
    expect(validated.stdout).toContain('not semantic correctness or product approval');
  });
});
