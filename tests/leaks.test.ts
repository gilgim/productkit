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
import { computeEntryHash, judgeCompletion, renderPresentation } from '../src/schema/clarification.js';
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
    const prompt = promptFixture('첫 문장이다. 비유: 둘째 메모. 예시: 셋째 메모.');
    const skipping = confirmedFixture(validSteps(['첫 문장이다.']), prompt);
    const judgement = judgeCompletion(skipping, prompt);
    expect(judgement.confirmed).toBe(false);
    if (!judgement.confirmed) { expect(judgement.reason).toBe('uncovered_spans'); expect(judgement.detail).toContain('SPN-002, SPN-003'); }
    const steps = validSteps(['첫 문장이다.']);
    steps.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '비유로 쓴 문장' }, { span_ref: 'SPN-003', disposition: 'non_requirement', reason: '예시로 든 문장' }];
    expect(judgeCompletion(confirmedFixture(steps, prompt), prompt).confirmed).toBe(true);
  });

  it('clarify prints every span set aside as non_requirement, with its text, so a reader can check the reason', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    const { runInit } = await import('../src/cli/commands/init.js');
    const { runClarify } = await import('../src/cli/commands/clarify.js');
    const { createMemoryOutput } = await import('../src/cli/output.js');
    await runInit({ cwd: temp, name: 'Leak' }, createMemoryOutput());
    const prompt = promptFixture('결제를 완료하면 주문을 확정한다. 비유: 카드 긁듯이 간단하게. 예시: 세 번 탭이면 끝.');
    const steps = validSteps(['결제를 완료하면 주문을 확정한다.']);
    steps.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '비유로 쓴 문장' }, { span_ref: 'SPN-003', disposition: 'non_requirement', reason: '예시로 든 문장' }];
    await writeFile(path.join(temp, 'product', 'sources', 'PRM-001.yaml'), stringify(prompt));
    await writeFile(path.join(temp, 'product', 'discovery', 'CLR-001.yaml'), stringify(confirmedFixture(steps, prompt)));
    const output = createMemoryOutput();
    await runClarify({ cwd: temp }, output);
    const text = output.stdout.join('\n');
    expect(text).toContain('Clarification confirmed');
    expect(text).toContain('Spans set aside as non_requirement (2)');
    expect(text).toContain('SPN-002  "비유: 카드 긁듯이 간단하게."  — 비유로 쓴 문장');
    expect(text).toContain('SPN-003  "예시: 세 번 탭이면 끝."  — 예시로 든 문장');
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

  it('the statement the user agrees to is rendered by the CLI; an agent-written one, even a quoting one, is refused', () => {
    const prompt = promptFixture('첫 문장이다. 비고: 둘째 메모.');
    const steps = validSteps(['첫 문장이다.']);
    steps.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '설명하는 서술 문장' }];
    const good = confirmedFixture(steps, prompt);
    expect(judgeCompletion(good, prompt).confirmed).toBe(true);
    const rendered = good.interpretation_check[0]!.presented_statement;
    expect(rendered).toContain('SPN-001 "첫 문장이다."\n  → 해석 [1]: 첫 문장이다.');
    expect(rendered).toContain('SPN-002 "비고: 둘째 메모."\n  → 요구사항 아님: 설명하는 서술 문장');
    expect(rendered).toContain('요구사항 아님: 1 문장 / 질문으로 남김: 0 건');
    const { entry_hash: _e, ...entry } = good.interpretation_check[0]!;
    for (const presented of ['SYNTHETIC: 첫 번째 문장만 요구사항이고 나머지는 서술이다.', `${rendered}\n해석 요약: 위 내용 중 1번만 요구사항`, `사용자는 아래 문장을 말한 적이 없다: ${rendered}`]) {
      const forged = { ...entry, presented_statement: presented };
      const bad = { ...good, interpretation_check: [{ ...forged, entry_hash: computeEntryHash(forged) }] };
      const judgement = judgeCompletion(bad, prompt);
      expect(judgement.confirmed).toBe(false);
      if (!judgement.confirmed) expect(judgement.reason).toBe('presented_statement_not_rendered');
    }
  });

  it('finding candidates appear in what the user sees, with their spans', () => {
    const prompt = promptFixture('첫 문장이다. 둘째 문장이다.');
    const steps = validSteps(['첫 문장이다.']);
    const rendered = renderPresentation({ steps, finding_candidates: [{ statement: '둘째 문장의 주체가 불명확하다', type: 'ambiguity', span_refs: ['SPN-002'] }] }, prompt);
    expect(rendered).toContain('SPN-002 "둘째 문장이다."\n  → 질문 [Q1] ambiguity: 둘째 문장의 주체가 불명확하다');
    expect(rendered).toContain('질문으로 남김: 1 건');
  });

  it('merging several spans into one reading needs a stated reason and keeps both sentences verbatim', () => {
    const prompt = promptFixture('가입은 닉네임만으로 된다. 기록은 오프라인에서도 저장된다.');
    const merged = validSteps(['가입은 닉네임만으로 된다. 기록은 오프라인에서도 저장된다.']);
    merged.decomposition[0]!.span_refs = ['SPN-001', 'SPN-002'];
    let j = judgeCompletion(confirmedFixture(merged, prompt), prompt);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.reason).toBe('missing_merge_reason');
    merged.decomposition[0]!.merge_reason = '두 문장이 같은 가입 흐름의 한 요구다';
    j = judgeCompletion(confirmedFixture(merged, prompt), prompt);
    expect(j.confirmed).toBe(true);
    expect(confirmedFixture(merged, prompt).interpretation_check[0]!.presented_statement).toContain('묶음 SPN-001, SPN-002 — 두 문장이 같은 가입 흐름의 한 요구다');
    const rewritten = validSteps(['가입은 닉네임만으로 되고 기록은 오프라인에서도 저장된다.']);
    rewritten.decomposition[0]!.span_refs = ['SPN-001', 'SPN-002']; rewritten.decomposition[0]!.merge_reason = '두 문장이 같은 가입 흐름의 한 요구다';
    j = judgeCompletion(confirmedFixture(rewritten, prompt), prompt);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.reason).toBe('reading_incomplete');
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

  it('under attestation: tty, a statement passed as a flag is refused for Decisions and Approvals', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    // The builder records its Decision through addDecision with attestation 'flag'.
    await expect(buildLeakWorkspace(temp, { keepTtyAttestation: true })).rejects.toThrow(/typed on a terminal \(config attestation: tty\)/);
    const g = await gate();
    expect(g.check('attestation.policy')?.status).toBe('warn');
    await expect(recordApproval(g.root, g.report.id, 'SYNTHETIC USER ONLY: approve', 'synthetic', 'flag')).resolves.toMatchObject({ attestation: 'flag' });
    // Flip the policy back to tty: the flag-recorded Decision now fails the gate by name.
    const { readFile: rf, writeFile: wf } = await import('node:fs/promises');
    const cfg = path.join(g.root, 'config.yaml');
    await wf(cfg, (await rf(cfg, 'utf8')).replace(/^attestation:\s*flag\s*$/m, 'attestation: tty'));
    await expect(recordApproval(g.root, g.report.id, 'SYNTHETIC USER ONLY: approve again', 'synthetic', 'flag')).rejects.toThrow(/typed on a terminal/);
    const report = await createValidationReport(g.root, g.review.id);
    expect(report.readiness).toBe('blocked');
    expect(report.checks.find((c) => c.id === `decision.attestation.${g.decisionId}`)?.status).toBe('fail');
  });

  it('a finding candidate parked at clarify must become a user-confirmed Finding', async () => {
    let g = await gate({ candidate: 'none' });
    expect(g.report.readiness).toBe('blocked');
    expect(g.check('source.candidates')?.message).toContain('CLR-001#0 (SPN-001)');
    expect(g.review.input_fingerprint).toBeTruthy();
    await rm(temp, { recursive: true, force: true });
    g = await gate({ candidate: 'proposed' });
    expect(g.check('source.candidates')?.status).toBe('fail');
    await rm(temp, { recursive: true, force: true });
    g = await gate({ candidate: 'confirmed' });
    expect(g.check('source.candidates')).toBeUndefined();
    expect(g.report.readiness).toBe('ready');
  });

  it('an agent-proposed Finding cannot hold a Node out of the Definition; a user-confirmed one can', async () => {
    let g = await gate({ itemNodes: ['NOD-001-1', 'NOD-001-2', 'NOD-001-3'], openFindingNodes: ['NOD-001-4'], openFindingsProposed: true });
    expect(g.check('definition.node_coverage')?.status).toBe('fail');
    expect(g.check('definition.node_coverage')?.message).toContain('NOD-001-4');
    await rm(temp, { recursive: true, force: true });
    g = await gate({ itemNodes: ['NOD-001-1', 'NOD-001-2', 'NOD-001-3'], openFindingNodes: ['NOD-001-4'] });
    expect(g.check('definition.node_coverage')?.status).toBe('pass');
  });

  it('a Policy citing Nodes does not place them; only Definition items do', async () => {
    const g = await gate({ itemNodes: ['NOD-001-1'], policyNodes: ['NOD-001-1', 'NOD-001-2', 'NOD-001-3', 'NOD-001-4'] });
    expect(g.check('definition.node_coverage')?.status).toBe('fail');
    expect(g.check('definition.node_coverage')?.message).toContain('NOD-001-2, NOD-001-3, NOD-001-4');
  });

  it('an exclusion resting on an agent-proposed Finding is refused', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    await expect(buildLeakWorkspace(temp, { excludeNodes: ['NOD-001-4'], exclusionFindingProposed: true })).rejects.toThrow(/confirmed|not been confirmed|review_status/);
  });

  it('not_applicable is allowed only for an area whose artifact kind is absent', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    const w = await buildLeakWorkspace(temp);
    const input = w.semanticInput as { areas: Record<string, unknown> };
    const na = { status: 'not_applicable', evidence_refs: [], rationale: 'n/a' };
    await expect(recordSemanticReview(w.root, { ...input, areas: { ...input.areas, graph_impact: na } } as never)).rejects.toThrow(/graph_impact can never be not_applicable/);
    await expect(recordSemanticReview(w.root, { ...input, areas: { ...input.areas, policy_consistency: na } } as never)).rejects.toThrow(/policy_consistency cannot be not_applicable while the workspace has policy records/);
    const review = await recordSemanticReview(w.root, { ...input, areas: { ...input.areas, assumptions: na } } as never);
    expect(review.id).toMatch(/^SEM-/);
  });

  it('a later review cannot drop an earlier unreviewed item even after the input fingerprint changes', async () => {
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    const w = await buildLeakWorkspace(temp);
    const input = w.semanticInput as { unreviewed_scope: string[]; input_fingerprint: string; definition_hash: string; created_at: string };
    // An earlier review recorded under a previous fingerprint (before a fresh ChallengeRun) listed an unreviewed item.
    const { createSemanticReview } = await import('../src/schema/validation.js');
    const earlier = createSemanticReview({ ...input, input_fingerprint: 'f'.repeat(64), unreviewed_scope: ['계약서 8종'], created_at: '2026-10-15T13:00:00.000Z' } as never);
    const { mkdir: md, writeFile: wf } = await import('node:fs/promises');
    await md(path.join(w.root, 'semantic-reviews'), { recursive: true });
    await wf(path.join(w.root, 'semantic-reviews', `${earlier.id}.yaml`), stringify(earlier));
    // The new, current-fingerprint review quietly drops it.
    await expect(recordSemanticReview(w.root, { ...input, unreviewed_scope: [], created_at: '2026-10-15T13:30:00.000Z' } as never)).rejects.toThrow(/listed "계약서 8종" as unreviewed/);
  });

  it('a forged Approval that is not in the supersedes chain does not become current', async () => {
    const g = await gate();
    const real = await recordApproval(g.root, g.report.id, 'SYNTHETIC USER ONLY: approve', 'synthetic', 'flag');
    const { approvalSchema } = await import('../src/schema/validation.js');
    const { sha256Hex, canonicalJson } = await import('../src/clarification/hash.js');
    const base = { schema_version: 1 as const, definition_ref: real.definition_ref, definition_hash: real.definition_hash, validation_ref: real.validation_ref, validation_hash: real.validation_hash, input_fingerprint: real.input_fingerprint, user_statement: 'FORGED', scope: 'all', attestation: 'tty' as const };
    const entry_hash = sha256Hex(canonicalJson(base));
    const forged = approvalSchema.parse({ ...base, entry_hash, id: `APR-${entry_hash.slice(0, 16)}`, created_at: '2000-01-01T00:00:00.000Z' });
    const { writeFile: wf } = await import('node:fs/promises');
    await wf(path.join(g.root, 'approvals', `${forged.id}.yaml`), stringify(forged));
    const { approvalStatus } = await import('../src/clarification/validation-store.js');
    const status = await approvalStatus(g.root);
    expect(status.status).toBe('stale');
    expect((status as { issue?: string }).issue).toMatch(/Expected one current Approval; found 2/);
  });

  it('a workspace that declares no attestation policy is blocked, not merely warned', async () => {
    const g = await gate();
    const { readFile: rf, writeFile: wf } = await import('node:fs/promises');
    const cfg = path.join(g.root, 'config.yaml');
    await wf(cfg, (await rf(cfg, 'utf8')).replace(/^attestation:.*$/m, ''));
    const report = await createValidationReport(g.root, g.review.id);
    expect(report.checks.find((c) => c.id === 'attestation.policy')?.status).toBe('fail');
  });

  it('the export shows the user\'s own sentences behind each item, every set-aside sentence, and how the approval was attested', async () => {
    const g = await gate();
    await recordApproval(g.root, g.report.id, 'SYNTHETIC USER ONLY: approve', 'synthetic', 'flag');
    const exported = await exportOpenSpec(g.root, g.temp, 'leak-export');
    const spec = await readFile(exported.files[1]!, 'utf8');
    const proposal = await readFile(exported.files[0]!, 'utf8');
    expect(spec).toContain("User's own words these Nodes came from:");
    expect(spec).toContain('PRM-001 SPN-002: "공물은 현금과 별도로 납부하며 자동 누적되지 않는다."');
    expect(spec).toContain('statement attestation: flag');
    expect(proposal).toContain("## Set aside from the user's prompt");
    expect(proposal).toContain('- Nothing was set aside.');
  });

  it('a reading must be the span text verbatim; a label, a paraphrase or a flipped sentence is refused', () => {
    const long = promptFixture('닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만, 환불은 7일 이내 전액');
    for (const reading of ['운동 앱의 요구사항', '닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만, 환불은 전액', '환불은 7일 이내 가능']) {
      const j = judgeCompletion(confirmedFixture(validSteps([reading]), long), long);
      expect(j.confirmed).toBe(false); if (!j.confirmed) { expect(j.reason).toBe('reading_incomplete'); expect(j.detail).toContain('must be the span text verbatim'); }
    }
    expect(judgeCompletion(confirmedFixture(validSteps(['닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만, 환불은 7일 이내 전액']), long), long).confirmed).toBe(true);
  });

  it('a question, a sentence with a number or a negation, or a long sentence cannot be set aside; reasons must say something', () => {
    const prompt = promptFixture('닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만. 그런데 알림을 끄면?');
    const aside = validSteps(['닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만.']);
    aside.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '질문 형태의 서술 문장' }];
    let j = judgeCompletion(confirmedFixture(aside, prompt), prompt);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/is a question/);
    aside.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: 'x' }];
    j = judgeCompletion(confirmedFixture(aside, prompt), prompt);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/6\+ characters/);
    const numbered = promptFixture('# 제목\n쿠폰은 주문당 1장만 사용 가능.');
    const aside2 = validSteps(['# 제목']);
    aside2.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '표의 행이라 제외함' }];
    j = judgeCompletion(confirmedFixture(aside2, numbered), numbered);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/carries a number/);
    const wordy = promptFixture('# 제목\n주요 화면 항목은 결제 수단 카드 계좌이체 휴대폰 결제 포인트 사용 쿠폰 적용 환불 계좌 등록 영수증 이메일 발송 찜 목록 관리');
    const aside3 = validSteps(['# 제목']);
    aside3.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '화면 항목 나열이라 요구사항 아님' }];
    j = judgeCompletion(confirmedFixture(aside3, wordy), wordy);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/content words/);
  });

  it('the rendered block follows the order of the prompt, so a heading set aside sits above its items', () => {
    const prompt = promptFixture('## 결제 화면\n카드 결제를 지원한다.\n계좌이체도 지원한다.');
    const steps = validSteps(['카드 결제를 지원한다.', '계좌이체도 지원한다.']);
    steps.decomposition[0]!.span_refs = ['SPN-002']; steps.decomposition[1]!.span_refs = ['SPN-003'];
    steps.elaboration = steps.decomposition.map((d) => ({ statement: d.statement, actor: '사용자', object: '결제', condition: '결제 시', action: '지원', result: '결제 완료' }));
    steps.span_coverage = [{ span_ref: 'SPN-001', disposition: 'non_requirement', reason: '절 제목이라 요구사항 아님' }];
    const rendered = renderPresentation({ steps, finding_candidates: [] }, prompt);
    const i1 = rendered.indexOf('SPN-001 "## 결제 화면"'); const i2 = rendered.indexOf('SPN-002 "카드 결제를 지원한다."'); const i3 = rendered.indexOf('SPN-003 "계좌이체도 지원한다."');
    expect(i1).toBeGreaterThan(-1); expect(i1).toBeLessThan(i2); expect(i2).toBeLessThan(i3);
    expect(rendered).toContain('관계 후보: 없음 — 각 행동 사이의 필수 의존이나 순서는 원문에 명시되어 있지 않다.');
    expect(rendered).toContain('달리 읽힐 수 있는 곳: 없음 —');
  });

  it('a candidate is carried only by a confirmed Finding about the same spans that is not dismissed', async () => {
    let g = await gate({ candidate: 'wrong_spans' });
    expect(g.check('source.candidates')?.message).toContain('carrying Finding names spans SPN-002, candidate has SPN-001');
    await rm(temp, { recursive: true, force: true });
    // A dismissed Finding is fine only if the sentence itself entered a requirement item verbatim.
    g = await gate({ candidate: 'dismissed' });
    expect(g.check('source.candidates')).toBeUndefined();
    await rm(temp, { recursive: true, force: true });
    g = await gate({ candidate: 'dismissed', itemNodes: ['NOD-001-2', 'NOD-001-3', 'NOD-001-4'] });
    expect(g.check('source.candidates')?.message).toMatch(/its Finding is dismissed, but the sentence .* is in no requirement item verbatim/);
  });

  it('an approval or an agreed confirmation whose statement says no is refused', async () => {
    const g = await gate();
    await expect(recordApproval(g.root, g.report.id, '승인하지 않습니다. 반대합니다.', 'all', 'flag')).rejects.toThrow(/reads as a refusal/);
    const { saysNo } = await import('../src/schema/text.js');
    expect(saysNo('네, 이대로 확정합니다')).toBe(false);
    expect(saysNo('동의하지 않는다. 틀렸다.')).toBe(true);
  });

  it('a Policy or Journey must carry its source Node text verbatim; the export shows it', async () => {
    const g = await gate();
    expect(g.check('policy.POL-1111111111111111')?.status).toBe('pass');
    const { readPolicies } = await import('../src/clarification/definition-store.js');
    const [policy] = await readPolicies(g.root);
    const { writeFile: wf } = await import('node:fs/promises');
    const { createPolicy } = await import('../src/schema/definition.js');
    const { id: _i, content_hash: _h, ...rest } = policy!;
    const flipped = createPolicy({ ...rest, id: policy!.id, outcome: '모든 환불 요청을 거부하고 수수료를 부과한다' } as never);
    await wf(path.join(g.root, 'policies', `${policy!.id}.yaml`), stringify(flipped));
    const report = await createValidationReport(g.root, g.review.id).catch((e: Error) => e);
    const msg = report instanceof Error ? report.message : report.checks.map((c) => c.message).join('\n');
    expect(msg).toMatch(/does not carry the text of its source Node|stale|missing/);
  });

  it('a goal item does not place Nodes; a requirement item must cite a Node', async () => {
    const g = await gate({ goalCover: true });
    expect(g.check('definition.node_coverage')?.status).toBe('fail');
    expect(g.check('definition.node_coverage')?.message).toContain('NOD-001-2, NOD-001-3, NOD-001-4');
  });

  it('control, invisible and HTML-comment characters are refused in every artifact', async () => {
    const { forbiddenTextIssue } = await import('../src/schema/text.js');
    expect(forbiddenTextIssue('정상 문장')).toBeUndefined();
    expect(forbiddenTextIssue('a\u001b[2Kb')).toMatch(/U\+001b/);
    expect(forbiddenTextIssue('a​b')).toMatch(/U\+200b/);
    expect(forbiddenTextIssue('a‮b')).toMatch(/U\+202e/);
    expect(forbiddenTextIssue('x <!-- hidden --> y')).toMatch(/HTML comment/);
    const prompt = promptFixture('첫 문장이다.');
    const steps = validSteps(['첫 문장이다.']);
    steps.definition[0]!.meaning = '뜻 <!-- 단 보스전은 예외 -->';
    const j = judgeCompletion(confirmedFixture(steps, prompt), prompt);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/HTML comment/);
  });

  it('two Clarifications for one Prompt, and a Prompt cut under an old segmentation rule, are refused', async () => {
    const g = await gate();
    const { writeFile: wf, readFile: rf } = await import('node:fs/promises');
    await wf(path.join(g.root, 'discovery', 'CLR-002.yaml'), (await rf(path.join(g.root, 'discovery', 'CLR-001.yaml'), 'utf8')).replace(/^id: CLR-001/m, 'id: CLR-002'));
    let report = await createValidationReport(g.root, g.review.id);
    expect(report.checks.find((c) => c.id === 'source.coverage')?.message).toContain('duplicate_clarification');
    await rm(path.join(g.root, 'discovery', 'CLR-002.yaml'));
    const { stringify: sy } = await import('yaml');
    const { parsePrompt } = await import('../src/schema/prompt.js');
    const { segmentSpans } = await import('../src/clarification/spans.js');
    const p = parsePrompt(await rf(path.join(g.root, 'sources', 'PRM-001.yaml'), 'utf8'));
    await wf(path.join(g.root, 'sources', 'PRM-001.yaml'), sy({ ...p, segmentation: 1, spans: segmentSpans(p.raw_text, 1) }));
    report = await createValidationReport(g.root, g.review.id);
    expect(report.checks.find((c) => c.id === 'source.segmentation.PRM-001')?.status).toBe('fail');
  });

  it('a ChallengeRun may mark only the policy area not_applicable, and only without Policies', async () => {
    const { judgeChallengeCompletion, challengeAreas } = await import('../src/schema/challenge.js');
    const base = { status: 'in_progress' as const, scope: { included: ['NDG-001'], excluded: [] }, inputs: [{ kind: 'node', ref: 'NOD-001-1', content_hash: 'a'.repeat(64) }], unavailable_inputs: [] };
    const na = Object.fromEntries(challengeAreas.map((a) => [a, { status: 'not_applicable' as const, rationale: '해당 없음입니다', evidence_refs: [] }]));
    expect(judgeChallengeCompletion({ ...base, areas: na as never }, new Set(['node']))).toBe('incomplete');
    const { challengeEvidenceFor } = await import('./helpers/gate-fixtures.js');
    const ok = Object.fromEntries(challengeAreas.map((a) => [a, a === 'policy_conflicts_duplicates' ? { status: 'not_applicable' as const, rationale: '정책 artifact 없음', evidence_refs: [] } : { status: 'reviewed' as const, evidence_refs: challengeEvidenceFor(a, { impactId: 'IMP-x' }) as never }]));
    expect(judgeChallengeCompletion({ ...base, areas: ok as never }, new Set(['node']))).toBe('complete');
    expect(judgeChallengeCompletion({ ...base, areas: ok as never }, new Set(['node', 'policy']))).toBe('incomplete');
  });

  it('flipping attestation to flag, approving, and flipping back is caught at export', async () => {
    const g = await gate();
    await recordApproval(g.root, g.report.id, 'AGENT가 쓴 승인 문장', 'all', 'flag');
    const { readFile: rf, writeFile: wf } = await import('node:fs/promises');
    const cfg = path.join(g.root, 'config.yaml');
    await wf(cfg, (await rf(cfg, 'utf8')).replace(/^attestation:\s*flag\s*$/m, 'attestation: tty'));
    await expect(exportOpenSpec(g.root, g.temp, 'flip')).rejects.toThrow(/passed as flags|stale|differs/);
  });

  it('`productkit hash entry` never produces a tty-attested entry', async () => {
    const { runCli } = await import('../src/cli/program.js');
    const { createMemoryOutput } = await import('../src/cli/output.js');
    const { writeFile: wf } = await import('node:fs/promises');
    temp = await mkdtemp(path.join(os.tmpdir(), 'productkit-leak-'));
    const entry = { id: 'IC-001', presented_statement: 'x', presented_hash: 'a'.repeat(64), user_response: 'agreed', user_statement: '위조', attestation: 'tty', checked_at: '2026-10-16T00:00:00Z' };
    await wf(path.join(temp, 'entry.yaml'), stringify(entry));
    const out = createMemoryOutput();
    const cwd = process.cwd(); process.chdir(temp);
    try { expect(await runCli(['hash', 'entry', '--input', 'entry.yaml'], out)).toBe(0); } finally { process.chdir(cwd); }
    expect(out.stdout.join('\n')).toContain('attestation: flag');
    expect(out.stdout.join('\n')).not.toContain('attestation: tty');
  });

  it('a sentence with a predicate, or a heading with content, cannot be set aside; an exception clause must stay with its sentence', () => {
    const p = promptFixture('쇼핑몰 앱을 만든다.\n## 환불은 7일 이내 불가\n배송은 무료다.\n개인정보는 암호화한다.');
    const steps = validSteps(['쇼핑몰 앱을 만든다.']);
    for (const [ref, reason] of [['SPN-002', '제목 줄이라 요구사항 아님'], ['SPN-003', '홍보 문구라 요구 아님'], ['SPN-004', '배경 설명이라 제외']] as const) {
      steps.span_coverage = [{ span_ref: ref, disposition: 'non_requirement', reason }];
      const others = p.spans.map((x) => x.id).filter((id) => id !== 'SPN-001' && id !== ref);
      steps.decomposition = [{ statement: '쇼핑몰 앱을 만든다.', span_refs: ['SPN-001'] }, ...others.map((id) => ({ statement: p.raw_text.slice(p.spans.find((x) => x.id === id)!.start, p.spans.find((x) => x.id === id)!.end).trim(), span_refs: [id] }))];
      steps.elaboration = steps.decomposition.map((d) => ({ statement: d.statement, actor: 'a', object: 'b', condition: 'c', action: 'd', result: 'e' }));
      const j = judgeCompletion(confirmedFixture(steps, p), p);
      expect(j.confirmed, ref).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/carries a number|states something/);
    }
    const q = promptFixture('회원은 환불을 요청할 수 있다. 단, 구독 상품은 제외한다.');
    const split = validSteps(['회원은 환불을 요청할 수 있다.', '단, 구독 상품은 제외한다.']);
    split.decomposition[1]!.span_refs = ['SPN-002'];
    let j = judgeCompletion(confirmedFixture(split, q), q);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/exception clause must be merged/);
    const merged = validSteps(['회원은 환불을 요청할 수 있다. 단, 구독 상품은 제외한다.']);
    merged.decomposition[0]!.span_refs = ['SPN-001', 'SPN-002']; merged.decomposition[0]!.merge_reason = '예외는 규칙과 한 문장으로 읽는다';
    expect(judgeCompletion(confirmedFixture(merged, q), q).confirmed).toBe(true);
  });

  it('a requirement item reads exactly as its Node text; reversing framing is not expressible', async () => {
    const g = await gate({ items: [{ kind: 'functional_requirement', text: '다음은 하지 않는다: 결제를 완료하면 주문을 확정한다.', nodes: ['NOD-001-1'] }, { kind: 'functional_requirement', text: '공물은 현금과 별도로 납부하며 자동 누적되지 않는다.', nodes: ['NOD-001-2'] }, { kind: 'functional_requirement', text: '실제 현금 구매와 환전은 없다.', nodes: ['NOD-001-3'] }, { kind: 'functional_requirement', text: '보스는 3층에 등장하며 즉사탄을 막지 못한다.', nodes: ['NOD-001-4'] }] });
    const check = g.report.checks.find((c) => c.id.startsWith('definition.item_restates.'));
    expect(check?.status).toBe('fail');
    expect(check?.message).toMatch(/must read exactly as its Node text/);
  });

  it('only structure and user-marked asides can be set aside; a bare line is content', () => {
    const p = promptFixture('쇼핑몰 앱을 만든다.\n배송 무료\n- 결제 수단: 카드, 계좌이체\n- 로그인: 소셜 로그인만\n참고: 디자인은 나중에');
    const steps = validSteps(['쇼핑몰 앱을 만든다.']);
    const text = (id: string) => { const sp = p.spans.find((x) => x.id === id)!; return p.raw_text.slice(sp.start, sp.end).trim(); };
    for (const ref of ['SPN-002', 'SPN-003'] as const) {
      steps.span_coverage = [{ span_ref: ref, disposition: 'non_requirement', reason: '배경 메모라 요구사항 아님' }];
      const others = ['SPN-002', 'SPN-003', 'SPN-004', 'SPN-005'].filter((id) => id !== ref && id !== 'SPN-005');
      steps.decomposition = [{ statement: '쇼핑몰 앱을 만든다.', span_refs: ['SPN-001'] }, ...others.map((id) => ({ statement: text(id), span_refs: [id] }))];
      steps.elaboration = steps.decomposition.map((d) => ({ statement: d.statement, actor: 'a', object: 'b', condition: 'c', action: 'd', result: 'e' }));
      steps.span_coverage.push({ span_ref: 'SPN-005', disposition: 'non_requirement', reason: '사용자가 참고로 표시함' });
      const j = judgeCompletion(confirmedFixture(steps, p), p);
      expect(j.confirmed, ref).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/did not mark as a heading|carries a negation/);
    }
    // "소셜 로그인만" — a trailing 만 is a condition word too.
    steps.span_coverage = [{ span_ref: 'SPN-004', disposition: 'non_requirement', reason: '목록 항목 메모라 제외' }, { span_ref: 'SPN-005', disposition: 'non_requirement', reason: '사용자가 참고로 표시함' }];
    steps.decomposition = [{ statement: '쇼핑몰 앱을 만든다.', span_refs: ['SPN-001'] }, { statement: text('SPN-002'), span_refs: ['SPN-002'] }, { statement: text('SPN-003'), span_refs: ['SPN-003'] }];
    steps.elaboration = steps.decomposition.map((d) => ({ statement: d.statement, actor: 'a', object: 'b', condition: 'c', action: 'd', result: 'e' }));
    const j = judgeCompletion(confirmedFixture(steps, p), p);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/negation\/condition word \(만\)/);
  });

  it('a Node is one user sentence verbatim: no slicing, no merging, no rewording; questions are never read', async () => {
    const { sliceIssue } = await import('../src/schema/clarification.js');
    const src = '결제가 완료되면 주문을 확정하고, 확인 이메일을 보내고, 재고를 차감한다.';
    expect(sliceIssue(src, [src])).toBeUndefined();
    expect(sliceIssue(src, ['결제가 완료되면 주문을 확정하고', '결제가 완료되면 확인 이메일을 보내고', '결제가 완료되면 재고를 차감한다'])).toMatch(/expected 1 Node\(s\), one per user sentence, got 3/);
    expect(sliceIssue('환불은 7일 이내 불가.', ['환불은 7일 이내 가능'])).toMatch(/must be the sentence verbatim/);
    expect(sliceIssue('비밀번호는 평문으로 안 저장한다.', ['비밀번호는 평문으로 저장한다'])).toMatch(/must be the sentence verbatim/);
    expect(sliceIssue('관리자가 사용자를 차단한다.', ['사용자가 관리자를 차단한다'])).toMatch(/must be the sentence verbatim/);
    const two = '회원은 반드시 이메일로 가입해야 한다. 환불은 불가능하다.';
    expect(sliceIssue(two, [two], ['회원은 반드시 이메일로 가입해야 한다.', '환불은 불가능하다.'])).toMatch(/expected 2 Node\(s\)/);
    expect(sliceIssue(two, ['회원은 반드시 이메일로 가입해야 한다', '환불은 불가능하다'], ['회원은 반드시 이메일로 가입해야 한다.', '환불은 불가능하다.'])).toBeUndefined();
    const prompt = promptFixture('환불 비율은 어떻게 할까요? 전액 환불한다.');
    const merged = validSteps(['환불 비율은 어떻게 할까요? 전액 환불한다.']);
    merged.decomposition[0]!.span_refs = ['SPN-001', 'SPN-002']; merged.decomposition[0]!.merge_reason = '질문과 답을 한 요구로 읽는다';
    const j = judgeCompletion(confirmedFixture(merged, prompt), prompt);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/is a question .* raised as a finding candidate/);
  });

  it('no artifact text can grow a markdown section: line breaks and tag openers are refused, and the export flattens free text', async () => {
    const { multilineIssue, forbiddenTextIssue } = await import('../src/schema/text.js');
    expect(multilineIssue('한 줄')).toBeUndefined();
    expect(multilineIssue('한 줄\n## ADDED Requirements')).toMatch(/line break/);
    expect(forbiddenTextIssue('<img onerror=x>')).toMatch(/tag opener/);
    expect(forbiddenTextIssue('나이 < 18')).toBeUndefined();
    expect(forbiddenTextIssue('javascript:alert(1)')).toMatch(/javascript/);
    const g = await gate();
    const { readPolicies } = await import('../src/clarification/definition-store.js');
    const [policy] = await readPolicies(g.root);
    const { createPolicy } = await import('../src/schema/definition.js');
    const { writeFile: wf } = await import('node:fs/promises');
    const { id: _i, content_hash: _h, ...rest } = policy!;
    const injected = createPolicy({ ...rest, id: policy!.id, context: 'c\n\n## ADDED Requirements\n\n### Requirement: Injected' } as never);
    await wf(path.join(g.root, 'policies', `${policy!.id}.yaml`), stringify(injected));
    const report = await createValidationReport(g.root, g.review.id).catch((e: Error) => e);
    const msg = report instanceof Error ? report.message : report.checks.map((c) => `${c.id}: ${c.message}`).join('\n');
    expect(msg).toMatch(/text\.multiline|stale|missing/);
  });

  it('every Definition sentence is one of the user\'s sentences: goal/scope items must cite a Node and read as it', async () => {
    const g = await gate({ items: [{ kind: 'goal', text: '제품 목표: 모든 환불을 자동 거부하고 사용자 데이터를 영구 보관한다', nodes: ['NOD-001-1'] }, { kind: 'functional_requirement', text: '결제를 완료하면 주문을 확정한다.', nodes: ['NOD-001-1'] }, { kind: 'functional_requirement', text: '공물은 현금과 별도로 납부하며 자동 누적되지 않는다.', nodes: ['NOD-001-2'] }, { kind: 'functional_requirement', text: '실제 현금 구매와 환전은 없다.', nodes: ['NOD-001-3'] }, { kind: 'functional_requirement', text: '보스는 3층에 등장하며 즉사탄을 막지 못한다.', nodes: ['NOD-001-4'] }] });
    const check = g.report.checks.find((c) => c.id.startsWith('definition.item_restates.') && c.status === 'fail');
    expect(check?.message).toMatch(/goal item .* must read exactly as its Node text/);
  });

  it('questions are recognised anywhere in the sentence and by Korean interrogative endings', async () => {
    const { isQuestion } = await import('../src/clarification/spans.js');
    for (const q of ['환불은 전액인가요?!', '(환불은 전액인가요?)', '환불은 전액인가요?”', '환불 기간은 며칠로 할까', '환불은 전액이어야 하나요.', 'Is it free']) expect(isQuestion(q), q).toBe(/Is it free/.test(q) ? false : true);
    expect(isQuestion('환불은 7일 이내 가능하다.')).toBe(false);
  });

  it('a Policy field must be a Node sentence as a whole, not a Node sentence inside other text', async () => {
    const g = await gate();
    const { readPolicies } = await import('../src/clarification/definition-store.js');
    const [policy] = await readPolicies(g.root);
    const { createPolicy } = await import('../src/schema/definition.js');
    const { writeFile: wf } = await import('node:fs/promises');
    const { id: _i, content_hash: _h, ...rest } = policy!;
    const framed = createPolicy({ ...rest, id: policy!.id, outcome: `다음은 하지 않는다: ${policy!.outcome}` } as never);
    await wf(path.join(g.root, 'policies', `${policy!.id}.yaml`), stringify(framed));
    const report = await createValidationReport(g.root, g.review.id).catch((e: Error) => e);
    const msg = report instanceof Error ? report.message : report.checks.map((c) => c.message).join('\n');
    expect(msg).toMatch(/must appear as a whole field|stale|missing/);
  });

  it('refusals in any recorded agreement are caught: wider lexicon, decide record, and stored statements re-read at validate', async () => {
    const { saysNo } = await import('../src/schema/text.js');
    for (const s of ['승인 보류', '나중에', '일단 넘어가자', '반려', 'I decline', 'pending', '승인 안돼', 'N', 'don\'t approve']) expect(saysNo(s), s).toBe(true);
    for (const s of ['네, 이대로 확정합니다', 'approved', '좋아요 진행']) expect(saysNo(s), s).toBe(false);
    const g = await gate();
    await expect(recordApproval(g.root, g.report.id, '승인 보류', 'all', 'flag')).rejects.toThrow(/reads as a refusal/);
    await expect(recordApproval(g.root, g.report.id, 'tbd', 'all', 'flag')).rejects.toThrow(/placeholder/);
    // A Decision recorded earlier with a refusing statement fails at validate.
    const { readFile: rf, writeFile: wf } = await import('node:fs/promises');
    const { readdir } = await import('node:fs/promises');
    const decDir = path.join(g.root, 'decisions');
    const files = (await readdir(decDir)).filter((f) => f.endsWith('.yaml'));
    const file = path.join(decDir, files[0]!);
    const text = await rf(file, 'utf8');
    await wf(file, text.replace(/^user_statement: .*$/m, 'user_statement: 반대합니다. 이 옵션은 거부한다.'));
    const report = await createValidationReport(g.root, g.review.id).catch((e: Error) => e);
    const msg = report instanceof Error ? report.message : report.checks.map((c) => `${c.id}: ${c.message}`).join('\n');
    expect(msg).toMatch(/reads as a refusal|mismatch|stale/);
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
