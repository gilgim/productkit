// Regression tests for the leak points found by adversarial fuzzing on
// 2026-10-16: each one reached READY / approval / export while source
// content was dropped, distorted, or the review was hollow. Every case here
// must stay BLOCKED. The baseline must stay READY so the gate is not simply
// always-fail.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { buildLeakWorkspace, type LeakOptions } from './helpers/leak-workspace.js';
import { createValidationReport, recordApproval, recordSemanticReview } from '../src/clarification/validation-store.js';
import { exportOpenSpec } from '../src/clarification/export-store.js';
import { computeEntryHash, judgeCompletion } from '../src/schema/clarification.js';
import { confirmedFixture, promptFixture, validSteps } from './helpers/gate-fixtures.js';

let temp: string;
afterEach(async () => { if (temp) await rm(temp, { recursive: true, force: true }); });

async function gate(o: LeakOptions = {}) {
  temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
  const w = await buildLeakWorkspace(temp, o);
  const review = await recordSemanticReview(w.root, w.semanticInput as never);
  const report = await createValidationReport(w.root, review.id);
  const check = (prefix: string) => report.checks.find((c) => c.id === prefix || c.id.startsWith(prefix + '.'));
  return { ...w, review, report, check };
}

describe('leak regression: source content cannot vanish silently', () => {
  it('baseline with every span, Node and area accounted for is READY, approvable and exportable', async () => {
    const g = await gate();
    expect(g.report.checks.filter((c) => c.status === 'fail').map((c) => `${c.id}: ${c.message}`)).toEqual([]);
    expect(g.report.readiness).toBe('ready');
    expect(g.check('source.coverage')?.status).toBe('pass');
    expect(g.check('definition.node_coverage')?.status).toBe('pass');
    const approval = await recordApproval(g.root, g.report.id, 'SYNTHETIC USER ONLY: approve', 'synthetic');
    expect(approval.id).toMatch(/^APR-/);
    const exported = await exportOpenSpec(g.root, g.temp, 'leak-baseline');
    const spec = await readFile(exported.files[1]!, 'utf8');
    expect(spec).toContain('Source Node text (verbatim, for comparison)');
    expect(spec).toContain('NOD-001-2: 공물은 현금과 별도로 납부하며 자동 누적되지 않는다.');
  });

  it('a Prompt that was never clarified blocks readiness', async () => {
    const g = await gate({ extraPrompt: '관리자는 모든 사용자의 결제 내역을 삭제할 수 있어야 한다.' });
    expect(g.report.readiness).toBe('blocked');
    expect(g.check('source.coverage')?.status).toBe('fail');
    expect(g.check('source.coverage')?.message).toContain('PRM-002 (missing_clarification)');
  });

  it('a Clarification that skips Prompt spans is not confirmed', () => {
    const prompt = promptFixture('첫 문장이다. 둘째 문장이다. 셋째 문장이다.');
    const skipping = confirmedFixture(validSteps(['첫 문장이다.']), prompt);
    const judgement = judgeCompletion(skipping, prompt);
    expect(judgement.confirmed).toBe(false);
    if (!judgement.confirmed) { expect(judgement.reason).toBe('uncovered_spans'); expect(judgement.detail).toContain('SPN-002, SPN-003'); }
    const steps = validSteps(['첫 문장이다.']);
    steps.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '비유 문장' }, { span_ref: 'SPN-003', disposition: 'non_requirement', reason: '예시' }];
    expect(judgeCompletion(confirmedFixture(steps, prompt), prompt).confirmed).toBe(true);
  });

  it('clarify prints every span set aside as non_requirement, with its text, so a reader can check the reason', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    const { runInit } = await import('../src/cli/commands/init.js');
    const { runClarify } = await import('../src/cli/commands/clarify.js');
    const { createMemoryOutput } = await import('../src/cli/output.js');
    await runInit({ cwd: temp, name: 'Leak' }, createMemoryOutput());
    const prompt = promptFixture('결제를 완료하면 주문을 확정한다. 마치 카드 긁듯이 간단해야 한다. 예를 들어 세 번 탭이면 끝.');
    const steps = validSteps(['결제를 완료하면 주문을 확정한다.']);
    steps.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '비유' }, { span_ref: 'SPN-003', disposition: 'non_requirement', reason: '예시' }];
    await writeFile(path.join(temp, 'product', 'sources', 'PRM-001.yaml'), stringify(prompt));
    await writeFile(path.join(temp, 'product', 'discovery', 'CLR-001.yaml'), stringify(confirmedFixture(steps, prompt)));
    const output = createMemoryOutput();
    await runClarify({ cwd: temp }, output);
    const text = output.stdout.join('\n');
    expect(text).toContain('Clarification confirmed');
    expect(text).toContain('Spans set aside as non_requirement (2)');
    expect(text).toContain('SPN-002  "마치 카드 긁듯이 간단해야 한다."  — 비유');
    expect(text).toContain('SPN-003  "예를 들어 세 번 탭이면 끝."  — 예시');
  });

  it('a Node left out of the Definition with no exclusion Decision and no open Finding blocks readiness', async () => {
    const g = await gate({ itemNodes: ['NOD-001-1'] });
    expect(g.report.readiness).toBe('blocked');
    expect(g.check('definition.node_coverage')?.status).toBe('fail');
    expect(g.check('definition.node_coverage')?.message).toContain('NOD-001-2, NOD-001-3, NOD-001-4');
  });

  it('a Node held by an unresolved Finding counts as placed', async () => {
    const g = await gate({ itemNodes: ['NOD-001-1', 'NOD-001-2', 'NOD-001-3'], openFindingNodes: ['NOD-001-4'] });
    expect(g.check('definition.node_coverage')?.status).toBe('pass');
    expect(g.check('source.coverage')?.status).toBe('pass');
  });

  it('a Node excluded by an applied scope_exclusion Decision counts as placed', async () => {
    const g = await gate({ excludeNodes: ['NOD-001-4'] });
    expect(g.check('definition.node_coverage')?.status).toBe('pass');
  });

  it('an exclusion item citing a Decision that does not exist blocks readiness', async () => {
    const g = await gate({ excludeNodes: ['NOD-001-4'], exclusionDecisionRef: 'DEC-0123456789abcdef' });
    expect(g.report.readiness).toBe('blocked');
    expect(g.check('definition.references')?.status).toBe('fail');
    expect(g.check('definition.references')?.message).toContain('DEC-0123456789abcdef');
  });

  it('a Definition with only a goal is not a product definition', async () => {
    const g = await gate({ items: [{ kind: 'goal', text: 'x', nodes: ['NOD-001-1', 'NOD-001-2', 'NOD-001-3', 'NOD-001-4'] }] });
    expect(g.report.readiness).toBe('blocked');
    expect(g.check('definition.normative')?.status).toBe('fail');
  });

  it('a semantic review marked reviewed with no evidence is refused', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    const w = await buildLeakWorkspace(temp, { semanticEvidence: 'none' });
    await expect(recordSemanticReview(w.root, w.semanticInput as never)).rejects.toThrow(/hollow.*cites no evidence/);
  });

  it('a semantic review that cites the skill file as evidence is refused, and a hand-written one fails the gate', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    const w = await buildLeakWorkspace(temp, { semanticEvidence: 'skill' });
    await expect(recordSemanticReview(w.root, w.semanticInput as never)).rejects.toThrow(/hollow.*skill/);
    // Bypass `validate review` by writing the file directly, as an agent could.
    const { createSemanticReview } = await import('../src/schema/validation.js');
    const review = createSemanticReview(w.semanticInput as never);
    await writeFile(path.join(w.root, 'semantic-reviews', `${review.id}.yaml`), stringify(review)).catch(async () => { const { mkdir } = await import('node:fs/promises'); await mkdir(path.join(w.root, 'semantic-reviews'), { recursive: true }); await writeFile(path.join(w.root, 'semantic-reviews', `${review.id}.yaml`), stringify(review)); });
    const report = await createValidationReport(w.root, review.id);
    expect(report.readiness).toBe('blocked');
    expect(report.checks.find((c) => c.id === `semantic.${review.id}`)?.message).toContain('hollow');
  });

  it('the statement the user agrees to must quote every decomposed or set-aside span verbatim', () => {
    const prompt = promptFixture('첫 문장이다. 둘째 문장이다.');
    const steps = validSteps(['첫 문장이다.']);
    steps.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '서술' }];
    const good = confirmedFixture(steps, prompt);
    expect(judgeCompletion(good, prompt).confirmed).toBe(true);
    // Same steps, but the agent's summary paraphrases instead of quoting.
    const { entry_hash: _e, ...entry } = good.interpretation_check[0]!;
    const paraphrased = { ...entry, presented_statement: 'SYNTHETIC: 첫 번째 문장만 요구사항이고 나머지는 서술이다.' };
    const bad = { ...good, interpretation_check: [{ ...paraphrased, entry_hash: computeEntryHash(paraphrased) }] };
    const judgement = judgeCompletion(bad, prompt);
    expect(judgement.confirmed).toBe(false);
    if (!judgement.confirmed) { expect(judgement.reason).toBe('presented_statement_missing_source'); expect(judgement.detail).toContain('SPN-001, SPN-002'); }
  });

  it('a semantic review must carry a fidelity verdict for every item/Node pair; contradicts blocks', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    const w = await buildLeakWorkspace(temp);
    const input = w.semanticInput as { item_fidelity: Array<{ item_ref: string; node_ref: string; verdict: string; reason: string }> };
    const full = input.item_fidelity;
    await expect(recordSemanticReview(w.root, { ...input, item_fidelity: full.slice(1) } as never)).rejects.toThrow(/item_fidelity has no verdict for 1 item\/Node pair/);
    const flagged = full.map((f, i) => (i === 0 ? { ...f, verdict: 'contradicts', reason: 'item says auto-accrue; Node says separate payment' } : f));
    const review = await recordSemanticReview(w.root, { ...input, item_fidelity: flagged } as never);
    const report = await createValidationReport(w.root, review.id);
    expect(report.readiness).toBe('blocked');
    const check = report.checks.find((c) => c.id === `definition.fidelity.${full[0]!.item_ref}`);
    expect(check?.status).toBe('fail');
    expect(check?.message).toContain('contradicts its source');
  });

  it('an exclusion item must cite exactly the Nodes its Finding is about', async () => {
    const g = await gate({ excludeNodes: ['NOD-001-4'], exclusionItemNodes: ['NOD-001-3'] });
    expect(g.report.readiness).toBe('blocked');
    expect(g.check('definition.references')?.message).toMatch(/must cite exactly the Nodes its Finding\(s\) are about \(NOD-001-4\); it cites NOD-001-3/);
  });

  it('a reviewed area must cite the artifact kinds that area is about', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    const w = await buildLeakWorkspace(temp);
    const input = w.semanticInput as { areas: Record<string, { evidence_refs: unknown[] }> };
    const wrong = { ...input, areas: { ...input.areas, graph_impact: { ...input.areas.graph_impact, evidence_refs: input.areas.user_flow!.evidence_refs } } };
    await expect(recordSemanticReview(w.root, wrong as never)).rejects.toThrow(/graph_impact must cite at least one impact_report/);
  });

  it('a later review of the same inputs cannot drop what an earlier one listed as unreviewed', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    const w = await buildLeakWorkspace(temp);
    const input = w.semanticInput as { unreviewed_scope: string[]; unreviewed_scope_resolved: unknown[]; areas: Record<string, { evidence_refs: unknown[] }>; created_at: string };
    const first = await recordSemanticReview(w.root, { ...input, unreviewed_scope: ['계약서 8종'], created_at: '2026-10-15T13:00:00.000Z' } as never);
    expect((await createValidationReport(w.root, first.id)).readiness).toBe('blocked');
    // PAYLOAD's move: same fingerprint, unreviewed item silently moved out.
    await expect(recordSemanticReview(w.root, { ...input, unreviewed_scope: [], created_at: '2026-10-15T13:30:00.000Z' } as never)).rejects.toThrow(/listed "계약서 8종" as unreviewed; it must stay/);
    // The honest way: name it as resolved, with evidence.
    const second = await recordSemanticReview(w.root, { ...input, unreviewed_scope: [], unreviewed_scope_resolved: [{ item: '계약서 8종', evidence_refs: input.areas.acceptance_criteria!.evidence_refs }], created_at: '2026-10-15T13:31:00.000Z' } as never);
    expect((await createValidationReport(w.root, second.id)).readiness).toBe('ready');
  });

  it('a ChallengeRun whose areas cite no evidence is incomplete', async () => {
    const g = await gate({ challengeEvidence: [] });
    expect(g.report.readiness).toBe('blocked');
    expect(g.report.checks.find((c) => c.id.startsWith('challenge.'))?.status).toBe('fail');
  });

  it('a Finding marked resolved by a Decision that does not target it blocks readiness', async () => {
    const g = await gate({ resolvedByUnrelatedDecision: true });
    expect(g.report.readiness).toBe('blocked');
    const check = g.report.checks.find((c) => c.id.startsWith('finding.resolution.') && c.status === 'fail');
    expect(check?.message).toContain('does not target this Finding');
  });
});
