import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { stringify } from 'yaml';
import os from 'node:os';
import path from 'node:path';
import { createPolicy, createJourney, createProductDefinition, policySchema } from '../src/schema/definition.js';
import { createSemanticReview } from '../src/schema/validation.js';
import { recordSemanticReview, createValidationReport } from '../src/clarification/validation-store.js';
import { buildLeakWorkspace } from './helpers/leak-workspace.js';
import { promptFixture, twoNodeFixtures } from './helpers/gate-fixtures.js';
import { runInit } from '../src/cli/commands/init.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { runCli } from '../src/cli/program.js';
import { runGraphEdgeAdd } from '../src/cli/commands/graph.js';
import { parseGraphDocument } from '../src/schema/graph.js';
import { addFinding } from '../src/clarification/finding-store.js';
import { createChallengeRun, readChallengeRuns, updateChallengeRun } from '../src/clarification/challenge-store.js';

const h = 'a'.repeat(64);
const prov = { origin: 'user_decision' as const, source_refs: [{ kind: 'node' as const, ref: 'NOD-001-1', content_hash: h }], decision_refs: [{ kind: 'decision' as const, ref: 'DEC-1111111111111111', content_hash: h }], prompt_refs: [{ kind: 'prompt' as const, ref: 'PRM-001', content_hash: h }] };

describe('created artifacts hash the text the schema stores', () => {
  it('accepts padded Policy text (a YAML | block ends in a newline) and keeps untrimmed values as they are', () => {
    const policy = createPolicy({ schema_version: 1, id: 'POL-1111111111111111', context: '  checkout\n', actor: 'customer', condition_text: 'within 24 hours\n', condition: { op: 'eq', field: 'note', value_type: 'string', value: ' padded ' }, action: 'allow', outcome: 'approved\n', exceptions: [], provenance: prov });
    expect(policy.context).toBe('checkout'); expect(policy.outcome).toBe('approved');
    expect((policy.condition as { value: string }).value).toBe(' padded ');
    expect(policySchema.parse(JSON.parse(JSON.stringify(policy)))).toEqual(policy);
  });
  it('ignores a stale content_hash left on the input', () => {
    const base = { schema_version: 1 as const, id: 'POL-1111111111111111', context: 'checkout', actor: 'customer', condition_text: 'c', condition: { op: 'eq', field: 'f', value_type: 'boolean', value: true }, action: 'allow', outcome: 'ok', exceptions: [], provenance: prov };
    expect(createPolicy({ ...base, content_hash: 'f'.repeat(64) } as never).content_hash).toBe(createPolicy(base).content_hash);
  });
  it('accepts padded Journey and Definition text', () => {
    expect(createJourney({ schema_version: 1, actor: ' customer ', goal: 'cancel\n', entry_state: 'open', states: ['open', 'closed '], transitions: [], terminal_states: ['closed'], acceptance_criteria: ['done\n'], provenance: prov }).goal).toBe('cancel');
    expect(createProductDefinition({ schema_version: 1, status: 'draft', product_name: ' Sample\n', items: [{ id: 'ITM-aaaaaaaaaaaa', kind: 'functional_requirement', text: 'The customer can cancel.\n', provenance: prov }], journey_refs: [], policy_refs: [], finding_refs: [], assumption_refs: [], input_snapshot: [{ kind: 'prompt', ref: 'PRM-001', content_hash: h }], rules_version: 'definition/1' }).items[0]!.text).toBe('The customer can cancel.');
  });
  it('hashes a SemanticReview after defaults are filled', () => {
    const areas = Object.fromEntries(['requirement_completeness', 'user_flow', 'policy_consistency', 'acceptance_criteria', 'assumptions', 'graph_impact', 'traceability', 'counterexamples'].map((a) => [a, { status: 'reviewed', evidence_refs: [{ kind: 'definition', ref: 'DEF-1', content_hash: h }], rationale: 'checked\n' }]));
    const review = createSemanticReview({ schema_version: 1, definition_ref: 'DEF-1', definition_hash: h, input_fingerprint: h, assessor: 'ai', scope: ' all ', areas, finding_refs: [], unreviewed_scope: [], uncertainty: ['u'], summary: 's\n', created_at: '2026-10-16T00:00:00.000Z' } as never);
    expect(review.scope).toBe('all'); expect(review.item_fidelity).toEqual([]);
  });
});

describe('a Policy exception can cite a Graph Edge', () => {
  it('accepts the Edge IDs the graph uses', () => {
    const exception = { statement: 'Unless the order shipped.', relation_ref: 'EDG-001', source_refs: prov.source_refs };
    expect(() => createPolicy({ schema_version: 1, id: 'POL-1111111111111111', context: 'c', actor: 'a', condition_text: 'c', condition: { op: 'eq', field: 'f', value_type: 'boolean', value: true }, action: 'a', outcome: 'o', exceptions: [exception], provenance: prov })).not.toThrow();
  });
});

let temp = '';
afterEach(async () => { if (temp) await rm(temp, { recursive: true, force: true }); temp = ''; });

describe('a direct user Decision can answer a Proposal', () => {
  it('counts a verified direct Decision that cites the Proposal and covers its Findings', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-direct-answer-'));
    const w = await buildLeakWorkspace(temp, { directDecision: true });
    const review = await recordSemanticReview(w.root, w.semanticInput as never);
    const report = await createValidationReport(w.root, review.id);
    expect(report.checks.filter((c) => c.status === 'fail').map((c) => `${c.id}: ${c.message}`)).toEqual([]);
  });
});

describe('graph edge add stores a symmetric relation in canonical order', () => {
  it('swaps the endpoints instead of refusing them, and says so', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-symmetric-'));
    await runInit({ cwd: temp, now: new Date('2026-10-13T00:00:00Z') }, createMemoryOutput());
    const product = path.join(temp, 'product'); const { prompt, clarification, group } = twoNodeFixtures(); void promptFixture;
    await writeFile(path.join(product, 'sources', `${prompt.id}.yaml`), stringify(prompt)); await writeFile(path.join(product, 'discovery', `${clarification.id}.yaml`), stringify(clarification)); await writeFile(path.join(product, 'nodes', `${group.id}.yaml`), stringify(group));
    const file = path.join(temp, 'edge.yaml');
    await writeFile(file, stringify({ id: 'EDG-001', type: 'conflicts_with', source: 'NOD-001-2', target: 'NOD-001-1', basis: 'ai_inferred', reason: 'They cannot both hold.', status: 'proposed', confirmations: [] }));
    const out = createMemoryOutput(); await runGraphEdgeAdd({ cwd: temp, input: file }, out);
    const edge = parseGraphDocument(await readFile(path.join(product, 'graph', 'edges.yaml'), 'utf8')).edges[0]!;
    expect([edge.source, edge.target]).toEqual(['NOD-001-1', 'NOD-001-2']);
    expect(out.stdout.join('\n')).toMatch(/canonical/);
  });
});

describe('challenge review commands', () => {
  async function twoRuns() {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-review-runs-'));
    const w = await buildLeakWorkspace(temp);
    const [first] = await readChallengeRuns(w.root);
    const added = await addFinding(w.root, { issue_key: 'late-gap', type: 'flow_gap', severity: 'major', statement: 'A late gap was found after the review started.', related_refs: [{ kind: 'node', ref: 'NOD-001-1' }], evidence_refs: [{ kind: 'node', ref: 'NOD-001-1', detail: 'Node omits the late path.' }], counterexamples: [], ai_assessment: { is_ai_judgment: true, rationale: 'r', confidence: 'medium', uncertainty: ['u'] }, questions: ['q?'] });
    const second = await createChallengeRun(w.root);
    return { w, first: first!, second, findingId: added.finding.id };
  }
  async function cli(args: string[]) { const out = createMemoryOutput(); const cwd = process.cwd(); process.chdir(temp); try { const code = await runCli(args, out); return { code, text: [...out.stdout, ...out.stderr].join('\n') }; } finally { process.chdir(cwd); } }

  it('review-validate checks the most recently started review by default, not the last file name', async () => {
    const { w, first, second } = await twoRuns();
    // Whichever ID sorts last is made the older review, so file order and start order disagree.
    const [older, newer] = first.id.localeCompare(second.id) > 0 ? [first, second] : [second, first];
    await updateChallengeRun(w.root, older.id, (r) => ({ ...r, created_at: '2000-01-01T00:00:00.000Z' }));
    const { text } = await cli(['challenge', 'review-validate']);
    expect(text).toContain(`Review ${newer.id}:`); expect(text).not.toContain(`Review ${older.id}:`);
  });

  it('a stale review error names the inputs that changed', async () => {
    const { first, findingId } = await twoRuns();
    const { code, text } = await cli(['challenge', 'review-complete', first.id]);
    expect(code).toBe(1); expect(text).toContain(`finding:${findingId} added`);
  });
});
