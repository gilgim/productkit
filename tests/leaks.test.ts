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
    const prompt = promptFixture('첫 문장이다. 둘째 문장이다. 셋째 문장이다.');
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
    const prompt = promptFixture('결제를 완료하면 주문을 확정한다. 마치 카드 긁듯이 간단해야 한다. 예를 들어 세 번 탭이면 끝.');
    const steps = validSteps(['결제를 완료하면 주문을 확정한다.']);
    steps.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '비유로 쓴 문장' }, { span_ref: 'SPN-003', disposition: 'non_requirement', reason: '예시로 든 문장' }];
    await writeFile(path.join(temp, 'product', 'sources', 'PRM-001.yaml'), stringify(prompt));
    await writeFile(path.join(temp, 'product', 'discovery', 'CLR-001.yaml'), stringify(confirmedFixture(steps, prompt)));
    const output = createMemoryOutput();
    await runClarify({ cwd: temp }, output);
    const text = output.stdout.join('\n');
    expect(text).toContain('Clarification confirmed');
    expect(text).toContain('Spans set aside as non_requirement (2)');
    expect(text).toContain('SPN-002  "마치 카드 긁듯이 간단해야 한다."  — 비유로 쓴 문장');
    expect(text).toContain('SPN-003  "예를 들어 세 번 탭이면 끝."  — 예시로 든 문장');
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
    const prompt = promptFixture('첫 문장이다. 둘째 문장이다.');
    const steps = validSteps(['첫 문장이다.']);
    steps.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '설명하는 서술 문장' }];
    const good = confirmedFixture(steps, prompt);
    expect(judgeCompletion(good, prompt).confirmed).toBe(true);
    const rendered = good.interpretation_check[0]!.presented_statement;
    expect(rendered).toContain('SPN-001 "첫 문장이다."\n  → 해석 [1]: 첫 문장이다.');
    expect(rendered).toContain('SPN-002 "둘째 문장이다."\n  → 요구사항 아님: 설명하는 서술 문장');
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

  it('merging several spans into one reading, or reading a many-clause span as one statement, needs a stated reason', () => {
    const prompt = promptFixture('가입은 닉네임만으로 된다. 기록은 오프라인에서도 저장된다.');
    const merged = validSteps(['가입은 닉네임만으로 되고 기록은 오프라인에서도 저장된다.']);
    merged.decomposition[0]!.span_refs = ['SPN-001', 'SPN-002'];
    let j = judgeCompletion(confirmedFixture(merged, prompt), prompt);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.reason).toBe('missing_merge_reason');
    merged.decomposition[0]!.merge_reason = '두 문장이 같은 가입 흐름의 한 요구다';
    j = judgeCompletion(confirmedFixture(merged, prompt), prompt);
    expect(j.confirmed).toBe(true);
    expect(confirmedFixture(merged, prompt).interpretation_check[0]!.presented_statement).toContain('묶음 SPN-001, SPN-002 — 두 문장이 같은 가입 흐름의 한 요구다');
    expect(confirmedFixture(merged, prompt).interpretation_check[0]!.presented_statement).toContain('→ 해석 [1] 과 함께 읽음 (SPN-001, SPN-002)');

    const long = promptFixture('닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만, 환불은 7일 이내 전액');
    const one = validSteps(['닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만, 환불은 7일 이내 전액']);
    j = judgeCompletion(confirmedFixture(one, long), long);
    expect(j.confirmed).toBe(false); if (!j.confirmed) { expect(j.reason).toBe('missing_merge_reason'); expect(j.detail).toMatch(/clause separators/); }
    one.decomposition[0]!.single_statement_reason = '사용자가 한 줄로 쓴 목록이라 묶어서 확인받고 Node 단계에서 나눈다';
    expect(judgeCompletion(confirmedFixture(one, long), long).confirmed).toBe(true);
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

  it('a reading that labels a sentence instead of restating it is refused', () => {
    const long = promptFixture('닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만, 환불은 7일 이내 전액');
    const label = validSteps(['운동 앱의 요구사항']);
    label.decomposition[0]!.single_statement_reason = '원문이 한 문장이라 하나로 읽음';
    const j = judgeCompletion(confirmedFixture(label, long), long);
    expect(j.confirmed).toBe(false); if (!j.confirmed) { expect(j.reason).toBe('reading_incomplete'); expect(j.detail).toMatch(/drop these numbers|content words/); }
    // Dropping one number is enough to fail.
    const partial = validSteps(['닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만, 환불은 전액']);
    partial.decomposition[0]!.single_statement_reason = '한 줄 목록이라 묶어 확인받는다';
    const j2 = judgeCompletion(confirmedFixture(partial, long), long);
    expect(j2.confirmed).toBe(false); if (!j2.confirmed) expect(j2.detail).toContain('7일');
  });

  it('merging spans does not exempt a many-clause span from the clause rule; a question cannot be set aside; reasons must say something', () => {
    const prompt = promptFixture('닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만. 그런데 알림을 끄면?');
    const merged = validSteps(['닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만. 그런데 알림을 끄면?']);
    merged.decomposition[0]!.span_refs = ['SPN-001', 'SPN-002'];
    merged.decomposition[0]!.merge_reason = '같은 흐름의 문장들이라 묶음';
    let j = judgeCompletion(confirmedFixture(merged, prompt), prompt);
    expect(j.confirmed).toBe(false); if (!j.confirmed) { expect(j.reason).toBe('missing_merge_reason'); expect(j.detail).toMatch(/only reading of SPN-001/); }
    const aside = validSteps(['닉네임만으로 가입하고, 기록은 오프라인 저장이며, 친구는 하루 5명까지, 결제는 월 구독만.']);
    aside.decomposition[0]!.single_statement_reason = '한 줄 목록이라 묶어 확인받는다';
    aside.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: '질문 형태 서술' }];
    j = judgeCompletion(confirmedFixture(aside, prompt), prompt);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/is a question/);
    aside.span_coverage = [{ span_ref: 'SPN-002', disposition: 'non_requirement', reason: 'x' }];
    j = judgeCompletion(confirmedFixture(aside, prompt), prompt);
    expect(j.confirmed).toBe(false); if (!j.confirmed) expect(j.detail).toMatch(/6\+ characters/);
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
