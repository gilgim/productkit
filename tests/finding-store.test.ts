import { afterEach, describe, expect, it } from 'vitest';
import { allowFlagAttestation } from './helpers/gate-fixtures.js';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { runInit } from '../src/cli/commands/init.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { addFinding, confirmFinding } from '../src/clarification/finding-store.js';
import { promptFixture, confirmedFixture, groupFixture } from './helpers/gate-fixtures.js';

let root = '';
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });
const input = {
  issue_key: 'missing-payment-timeout', type: 'flow_gap' as const, severity: 'major' as const,
  statement: 'Payment timeout behavior is unspecified.', related_refs: [{ kind: 'node' as const, ref: 'NOD-001-1' }],
  evidence_refs: [{ kind: 'prompt' as const, ref: 'PRM-001', detail: 'Prompt omits timeout path.' }], counterexamples: [],
  ai_assessment: { is_ai_judgment: true as const, rationale: 'No timeout behavior found.', confidence: 'medium' as const, uncertainty: ['Could be in an external policy.'] }, questions: ['What happens on timeout?'],
};
async function workspace() {
  root = await mkdtemp(path.join(tmpdir(), 'productkit-finding-store-')); await runInit({ cwd: root }, createMemoryOutput()); await allowFlagAttestation(path.join(root, 'product'));
  const product = path.join(root, 'product'); const prompt = promptFixture(); const clarification = confirmedFixture(undefined, prompt); const group = groupFixture(clarification.steps);
  await writeFile(path.join(product, 'sources', `${prompt.id}.yaml`), stringify(prompt)); await writeFile(path.join(product, 'discovery', `${clarification.id}.yaml`), stringify(clarification)); await writeFile(path.join(product, 'nodes', `${group.id}.yaml`), stringify(group)); return product;
}

describe('Finding persistence and references', () => {
  it('deduplicates identical proposed Findings and rejects nonexistent typed refs', async () => {
    const product = await workspace(); const first = await addFinding(product, input); const second = await addFinding(product, input);
    expect(first.created).toBe(true); expect(second.created).toBe(false); expect(second.finding.id).toBe(first.finding.id);
    await expect(addFinding(product, { ...input, related_refs: [{ kind: 'node', ref: 'NOD-999-1' }] })).rejects.toThrow('unresolved references');
  });

  it('persists confirmation separately and preserves original bytes if publish fails', async () => {
    const product = await workspace(); const created = await addFinding(product, input); const confirmed = await confirmFinding(product, created.finding.id, 'confirmed', 'Yes, this path is missing.', 'Reviewed the current requirement.');
    expect(confirmed.review_status).toBe('confirmed'); expect(confirmed.resolution_status).toBe('unresolved');
    const file = path.join(product, 'findings', 'FND-0000000000000000.yaml'); await mkdir(file); await writeFile(path.join(file, 'keep.txt'), 'preserve');
    await expect(addFinding(product, { ...input, issue_key: 'causes-different-id' })).rejects.toThrow();
    expect(await readFile(path.join(file, 'keep.txt'), 'utf8')).toBe('preserve');
  });

  it('refuses a confirmation that says no but accepts the same limit as a caveat', async () => {
    const product = await workspace(); const created = await addFinding(product, input);
    await expect(confirmFinding(product, created.finding.id, 'confirmed', '맞다. 단, 중앙 서버 구축을 승인하는 건 아니야.', 'Reviewed.')).rejects.toMatchObject({ message: expect.stringMatching(/reads as a refusal/), details: expect.arrayContaining([expect.stringMatching(/--caveat/)]) });
    for (const bad of ['first line\nsecond line', 'TBD']) await expect(confirmFinding(product, created.finding.id, 'confirmed', '질문이 맞다.', 'Reviewed.', 'flag', bad)).rejects.toThrow(/caveat/);
    const confirmed = await confirmFinding(product, created.finding.id, 'confirmed', '질문이 맞다.', 'Reviewed.', 'flag', '단, 중앙 서버 구축을 승인하는 건 아니야.');
    expect(confirmed.review_status).toBe('confirmed'); expect(confirmed.confirmation_history.at(-1)!.user_caveat).toBe('단, 중앙 서버 구축을 승인하는 건 아니야.');
  });
});
