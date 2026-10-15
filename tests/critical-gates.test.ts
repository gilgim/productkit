import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';
import { runInit } from '../src/cli/commands/init.js';
import { runIntake } from '../src/cli/commands/intake.js';
import { runClarify } from '../src/cli/commands/clarify.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { afterEach, describe, expect, it } from 'vitest';
import { judgeNodeSetCompletion, nodeGroupSchema, evaluateAtomicityFinal } from '../src/schema/node.js';
import { judgeCompletion, clarificationContentHash, computeEntryHash } from '../src/schema/clarification.js';
import { confirmedFixture, promptFixture, validSteps, groupFixture, atomicNodeFixture } from './helpers/gate-fixtures.js';
const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(cwd => rm(cwd, { recursive: true, force: true })));
});

describe('critical completion regressions (synthetic confirmations)', () => {
  it('blocks empty clarification steps even with an agreed hash-matching record', () => {
    const steps = { definition: [], decomposition: [], elaboration: [], relation_check: [], counterexample: [] };
    expect(judgeCompletion(confirmedFixture(steps), promptFixture()).confirmed).toBe(false);
  });
  it('blocks a final Node that still requires splitting', () => {
    const node = atomicNodeFixture();
    node.atomicity.single_verifiable_subject.verdict = 'no';
    node.atomicity.decomposability.verdict = 'valid_split';
    node.atomicity.final = evaluateAtomicityFinal(node.atomicity);
    expect(node.atomicity.final).toBe('split_required');
    const result = judgeNodeSetCompletion(groupFixture(validSteps(), [node]), validSteps(), { clarification: confirmedFixture(), prompt: promptFixture() });
    expect(result.status).toBe('needs_review');
    if (result.status === 'needs_review') expect(result.reasons).toContain('split_required');
  });
  it('blocks a missing Prompt even when clarification and agreement are otherwise complete', () => {
    expect(judgeCompletion(confirmedFixture()).confirmed).toBe(false);
  });
  it('invalidates clarification when Prompt raw text changes without its hash', () => {
    const prompt = promptFixture();
    expect(judgeCompletion(confirmedFixture(), { ...prompt, raw_text: '변경된 요구사항' }).confirmed).toBe(false);
  });
  it('confirms complete steps and current Prompt with a matching synthetic agreement', () => {
    expect(judgeCompletion(confirmedFixture(), promptFixture())).toEqual({ confirmed: true });
  });
  it('CLI accepts current complete clarification and verifies the actual Prompt file', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'pk-critical-valid-')); temporaryRoots.push(cwd);
    await runInit({ cwd }, createMemoryOutput());
    await runIntake({ cwd, text: promptFixture().raw_text }, createMemoryOutput());
    await writeFile(path.join(cwd,'product/discovery/CLR-001.yaml'), stringify(confirmedFixture()));
    const output = createMemoryOutput();
    await runClarify({ cwd }, output);
    expect(output.stdout.join('\n')).toContain('Clarification confirmed:');
  });
  it('CLI rejects a nonexistent Prompt reference without overwriting artifacts', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'pk-critical-')); temporaryRoots.push(cwd);
    await runInit({ cwd }, createMemoryOutput());
    await runIntake({ cwd, text: promptFixture().raw_text }, createMemoryOutput());
    const c = confirmedFixture(); c.prompt_ref = 'PRM-999';
    const file = path.join(cwd,'product/discovery/CLR-001.yaml');
    await writeFile(file, stringify(c));
    const output = createMemoryOutput();
    await expect(runClarify({ cwd, prompt: 'PRM-001' }, output)).rejects.toThrow('identity/reference');
    expect(output.stdout.join('\n')).not.toContain('Clarification confirmed:');
    expect(await readFile(file,'utf8')).toBe(stringify(c));
  });
  it('invalidates a modeled group when the upstream Prompt changes', () => {
    const group = groupFixture();
    const clarification = confirmedFixture();
    const prompt = promptFixture();
    expect(judgeNodeSetCompletion(group, validSteps(), { clarification, prompt }).status).toBe('modeled');
    expect(judgeNodeSetCompletion(group, validSteps(), { clarification, prompt: { ...prompt, raw_text: '변경된 요구사항' } }).status).toBe('needs_review');
  });
  it('requires per-decomposition meaning reviews including conditions, operators and exceptions', () => {
    const group = groupFixture();
    group.distortion_checks = [];
    expect(judgeNodeSetCompletion(group, validSteps(), { clarification: confirmedFixture(), prompt: promptFixture() }).status).toBe('needs_review');
  });
  it('preserves the original split-required Node and links genuinely new atomic replacements', () => {
    const splitSteps = validSteps(['결제가 완료되면 주문을 확정하고 이메일을 보낸다.']);
    const original = promptFixture(splitSteps.decomposition[0]!.statement);
    const clarification = confirmedFixture(splitSteps, original);
    const old = atomicNodeFixture(splitSteps.decomposition[0]!.statement);
    old.atomicity.single_verifiable_subject.verdict = 'no';
    old.atomicity.decomposability.verdict = 'valid_split';
    old.atomicity.final = evaluateAtomicityFinal(old.atomicity);
    // Verbatim slices of the sentence; the shared trigger is carried as a second slice.
    const children = ['NOD-001-2', 'NOD-001-3'].map((id, i) => ({ ...atomicNodeFixture(i ? '결제가 완료되면 이메일을 보낸다.' : '결제가 완료되면 주문을 확정하고'), id, split_from: old.id }));
    const group = nodeGroupSchema.parse({ ...groupFixture(splitSteps), clarification_content_hash: clarificationContentHash(clarification), nodes: children, retired_nodes: [old] });
    expect(group.retired_nodes).toEqual([old]);
    expect(group.nodes.map(n => n.split_from)).toEqual([old.id, old.id]);
    // Lineage is well-formed, but an agent-made split is still not a modeled NodeGroup: Nodes are whole user sentences.
    const result = judgeNodeSetCompletion(group, splitSteps, { clarification, prompt: original });
    expect(result.status).toBe('needs_review');
    if (result.status === 'needs_review') { expect(result.reasons).toContain('restatement_mismatch'); expect(result.reasons).not.toContain('invalid_split_lineage'); }
  });
  it('blocks dangling replacement lineage rather than silently treating it as an atomic split', () => {
    const child = { ...atomicNodeFixture(), split_from: 'NOD-001-99' };
    const group = groupFixture(validSteps(), [child]);
    expect(judgeNodeSetCompletion(group, validSteps(), { clarification: confirmedFixture(), prompt: promptFixture() }).status).toBe('needs_review');
  });
  it.each([' ', 'TBD', 'unknown', '...', '미정', '해당 없음'])('blocks a structural placeholder %j with a matching approval hash', placeholder => {
    const steps = validSteps(); steps.definition[0]!.meaning = placeholder;
    const result = judgeCompletion(confirmedFixture(steps), promptFixture());
    expect(result).toMatchObject({ confirmed: false, reason: 'incomplete_steps' });
  });
  it.each(['definition', 'decomposition', 'elaboration', 'relation_check', 'counterexample'] as const)('blocks a missing output for %s', step => {
    const steps = validSteps(); steps[step] = [];
    delete steps.relation_check_no_items_reason; delete steps.counterexample_no_items_reason;
    expect(judgeCompletion(confirmedFixture(steps), promptFixture()).confirmed).toBe(false);
  });
  it('rejects broken internal statement and source span references', () => {
    const steps = validSteps(); steps.elaboration[0]!.statement = '없는 분해 항목';
    expect(judgeCompletion(confirmedFixture(steps), promptFixture())).toMatchObject({ confirmed: false, reason: 'invalid_step_reference' });
    const spans = validSteps(); spans.decomposition[0]!.span_refs = ['SPN-999'];
    expect(judgeCompletion(confirmedFixture(spans), promptFixture())).toMatchObject({ confirmed: false, reason: 'invalid_step_reference' });
    const relations = validSteps(); delete relations.relation_check_no_items_reason;
    relations.relation_check = [{ statement_a: relations.decomposition[0]!.statement, statement_b: '없는 분해 항목', relation_candidate: '선후관계 후보' }];
    expect(judgeCompletion(confirmedFixture(relations), promptFixture())).toMatchObject({ confirmed: false, reason: 'invalid_step_reference' });
  });
  it('invalidates a changed Prompt even when its raw hash and spans were recomputed', () => {
    const changed = promptFixture('새로운 원문입니다.');
    expect(judgeCompletion(confirmedFixture(), changed)).toMatchObject({ confirmed: false, reason: 'prompt_changed_since_clarification' });
  });
  it('rejects changed Prompt spans even if raw hash is unchanged', () => {
    const prompt = promptFixture(); prompt.spans[0]!.end = 1;
    expect(judgeCompletion(confirmedFixture(), prompt)).toMatchObject({ confirmed: false, reason: 'prompt_integrity_violation' });
  });
  it('keeps readable legacy artifacts blocked without filling missing Prompt snapshots', () => {
    const clarification = confirmedFixture(); delete clarification.prompt_content_hash;
    expect(judgeCompletion(clarification, promptFixture()).confirmed).toBe(false);
    const group = groupFixture(); delete group.clarification_content_hash;
    expect(judgeNodeSetCompletion(group, validSteps(), { clarification: confirmedFixture(), prompt: promptFixture() }).status).toBe('needs_review');
  });
  it('invalidates a group after Clarification changes and after a new confirmation of the same steps', () => {
    const group = groupFixture();
    const steps = validSteps(); steps.definition[0]!.meaning = '새롭게 검토한 주문 확정의 정의';
    const changed = confirmedFixture(steps);
    expect(judgeNodeSetCompletion(group, steps, { clarification: changed, prompt: promptFixture() }).status).toBe('needs_review');
    const rechecked = confirmedFixture();
    const { entry_hash: _hash, ...old } = rechecked.interpretation_check[0]!;
    const next = { ...old, id: 'IC-TEST-002' };
    rechecked.interpretation_check.push({ ...next, entry_hash: computeEntryHash(next) });
    expect(judgeCompletion(rechecked, promptFixture()).confirmed).toBe(true);
    expect(judgeNodeSetCompletion(group, validSteps(), { clarification: rechecked, prompt: promptFixture() }).status).toBe('needs_review');
  });
  it.each(['condition_preservation', 'operator_preservation', 'exception_preservation'] as const)('blocks missing or uncertain %s review', aspect => {
    const group = groupFixture(); delete group.distortion_checks[0]![aspect];
    const source = { clarification: confirmedFixture(), prompt: promptFixture() };
    expect(judgeNodeSetCompletion(group, validSteps(), source).status).toBe('needs_review');
  });
  it('rejects a falsified atomic final instead of satisfying split completion', () => {
    const node = atomicNodeFixture(); node.atomicity.single_verifiable_subject.verdict = 'no'; node.atomicity.decomposability.verdict = 'valid_split';
    const result = judgeNodeSetCompletion(groupFixture(validSteps(), [node]), validSteps(), { clarification: confirmedFixture(), prompt: promptFixture() });
    expect(result.status).toBe('needs_review');
    if (result.status === 'needs_review') expect(result.reasons).toContain('atomicity_final_mismatch');
  });
  it('rejects duplicate Node IDs and split history with only one replacement', () => {
    const nodes = [atomicNodeFixture(), atomicNodeFixture()];
    const source = { clarification: confirmedFixture(), prompt: promptFixture() };
    expect(judgeNodeSetCompletion(groupFixture(validSteps(), nodes), validSteps(), source).status).toBe('needs_review');
    const old = atomicNodeFixture(); old.atomicity.single_verifiable_subject.verdict = 'no'; old.atomicity.decomposability.verdict = 'valid_split'; old.atomicity.final = evaluateAtomicityFinal(old.atomicity);
    const group = nodeGroupSchema.parse({ ...groupFixture(), nodes: [{ ...atomicNodeFixture(), id: 'NOD-001-2', split_from: old.id }], retired_nodes: [old] });
    expect(judgeNodeSetCompletion(group, validSteps(), source).status).toBe('needs_review');
  });
  it('preserves config extensions and comments while recording a blocked Gate', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'pk-critical-')); temporaryRoots.push(cwd);
    await runInit({ cwd }, createMemoryOutput());
    await runIntake({ cwd, text: promptFixture().raw_text }, createMemoryOutput());
    const configPath=path.join(cwd,'product/config.yaml');
    const original=(await readFile(configPath,'utf8'))+'\n# USER EXTENSION\ncustom: keep-me\n';
    await writeFile(configPath,original);
    await writeFile(path.join(cwd,'product/discovery/CLR-001.yaml'),stringify(confirmedFixture({ definition: [], decomposition: [], elaboration: [], relation_check: [], counterexample: [] })));
    await runClarify({ cwd },createMemoryOutput());
    const after=await readFile(configPath,'utf8');
    expect(after).toContain('# USER EXTENSION'); expect(after).toContain('custom: keep-me');
  });
});
