import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { runInit } from '../src/cli/commands/init.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { challengeAreas, challengeRunSchema, judgeChallengeCompletion } from '../src/schema/challenge.js';
import { createFinding } from '../src/schema/finding.js';
import { createChallengeRun, refreshChallengeRun, updateChallengeRun } from '../src/clarification/challenge-store.js';
import { promptFixture, confirmedFixture, groupFixture } from './helpers/gate-fixtures.js';

let root = '';
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });

async function workspace() {
  root = await mkdtemp(path.join(tmpdir(), 'productkit-challenge-'));
  await runInit({ cwd: root, now: new Date('2026-10-13T00:00:00Z') }, createMemoryOutput());
  const product = path.join(root, 'product'); const prompt = promptFixture(); const clarification = confirmedFixture(undefined, prompt); const group = groupFixture(clarification.steps);
  await writeFile(path.join(product, 'sources', `${prompt.id}.yaml`), stringify(prompt));
  await writeFile(path.join(product, 'discovery', `${clarification.id}.yaml`), stringify(clarification));
  await writeFile(path.join(product, 'nodes', `${group.id}.yaml`), stringify(group));
  return { product, prompt, group };
}

describe('Challenge coverage and freshness', () => {
  it('keeps semantic golden examples distinct from deterministic structural status', () => {
    const examples = [
      { label: 'normal requirement; no supported issue', type: undefined },
      { label: 'failure path omitted', type: 'flow_gap' as const },
      { label: 'boundary unspecified', type: 'unverifiable_requirement' as const },
      { label: 'incompatible policies in same scope', type: 'policy_conflict' as const },
      { label: 'stricter constraint on subset; not a conflict', type: undefined },
      { label: 'Graph relation meaning may be wrong', type: 'graph_relation_risk' as const },
      { label: 'Node may distort source condition', type: 'semantic_distortion' as const },
    ];
    for (const example of examples) {
      const candidate = example.type ? createFinding({
        issue_key: example.label, type: example.type, severity: 'minor', statement: example.label,
        related_refs: [{ kind: 'node', ref: 'NOD-001-1' }], evidence_refs: [{ kind: 'prompt', ref: 'PRM-001', detail: 'Fixture evidence only.' }],
        counterexamples: [{ condition: 'fixture condition', expected: 'specified behavior', observed: 'possible gap', status: 'hypothesis' }],
        ai_assessment: { is_ai_judgment: true, rationale: 'Curated example payload; not an AI result.', confidence: 'low', uncertainty: ['No model evaluation performed.'] }, questions: ['What applies?'],
      }) : undefined;
      expect(candidate?.review_status ?? 'no_finding_candidate').toBe(candidate ? 'proposed' : 'no_finding_candidate');
      expect(candidate?.resolution_status ?? 'not_applicable').toBe(candidate ? 'unresolved' : 'not_applicable');
    }
  });

  it('does not infer completion from zero Findings or an absent review record', async () => {
    expect(judgeChallengeCompletion({ areas: {} as never, scope: { included: [], excluded: [] }, inputs: [], unavailable_inputs: [], status: 'complete' })).toBe('incomplete');
  });

  it('requires all eight review areas but allows open Findings to remain separate', async () => {
    const { product } = await workspace(); const run = await createChallengeRun(product);
    expect(judgeChallengeCompletion(run)).toBe('incomplete');
    const complete = await updateChallengeRun(product, run.id, (current) => ({
      ...current, areas: Object.fromEntries(challengeAreas.map((area) => [area, { status: 'reviewed', evidence_refs: [] }])) as never,
      finding_refs: ['FND-0000000000000000'], status: 'complete',
    }));
    expect(judgeChallengeCompletion(complete)).toBe('complete');
    expect(challengeRunSchema.parse(complete).finding_refs).toHaveLength(1);
  });

  it('deduplicates same input run and marks Node changes stale without deleting review', async () => {
    const { product, group } = await workspace(); const first = await createChallengeRun(product); const rerun = await createChallengeRun(product);
    expect(rerun.id).toBe(first.id);
    const groupPath = path.join(product, 'nodes', `${group.id}.yaml`); const before = await readFile(groupPath, 'utf8'); group.nodes[0]!.statement += ' updated'; await writeFile(groupPath, stringify(group));
    expect((await refreshChallengeRun(product, first)).stale).toBe(true);
    expect(await readFile(path.join(product, 'reviews', `${first.id}.yaml`), 'utf8')).toContain(first.id);
    expect(before).not.toBe(await readFile(groupPath, 'utf8'));
  });
});
