// Builds a complete workspace in one call so leak-regression tests can mutate
// one thing and assert the gate closes. Every "user" statement here is
// SYNTHETIC TEST DATA, never consent. Mirrors tests/pipeline-built-cli-e2e
// but as a parameterised function.
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';

import { computePromptHash, type Prompt } from '../../src/schema/prompt.js';
import { segmentSpans } from '../../src/clarification/spans.js';
import { clarificationSchema, clarificationContentHash, computeEntryHash, interpretationCheckEntrySchema, stepsContentHash, type ClarificationSteps } from '../../src/schema/clarification.js';
import { evaluateAtomicityFinal, nodeGroupSchema, nodeSetContentHash, type Node } from '../../src/schema/node.js';
import { appendFindingConfirmation, createFinding, findingContentHash, findingHistoryEntryHash, findingSchema, toFindingInput } from '../../src/schema/finding.js';
import { challengeAreas } from '../../src/schema/challenge.js';
import { createChallengeRun, currentChallengeInputs, updateChallengeRun } from '../../src/clarification/challenge-store.js';
import { addDecision, addProposal } from '../../src/clarification/proposal-decision-store.js';
import { computeImpactReport } from '../../src/clarification/graph.js';
import { loadGraphWorkspace } from '../../src/clarification/provenance.js';
import { readGraphDocument, readRelationCandidates } from '../../src/clarification/graph-store.js';
import { createPolicy, createProductDefinition } from '../../src/schema/definition.js';
import { applyApplication, createApplication, recordApplicationVerification } from '../../src/clarification/definition-store.js';
import { currentValidationFingerprint } from '../../src/clarification/validation-store.js';
import { sha256Hex } from '../../src/clarification/hash.js';
import { runInit } from '../../src/cli/commands/init.js';
import { createMemoryOutput } from '../../src/cli/output.js';

export const RAW = '결제를 완료하면 주문을 확정한다. 공물은 현금과 별도로 납부하며 자동 누적되지 않는다. 실제 현금 구매와 환전은 없다. 보스는 3층에 등장하며 즉사탄을 막지 못한다.';
const SENTENCES = RAW.split(/(?<=\.)\s+/);

export interface LeakOptions {
  /** Decompose only the first N sentences (default: all four). */
  decompose?: number;
  /** Add a second Prompt that is never clarified. */
  extraPrompt?: string;
  /** Build Definition items from these Node refs (default: every Node). */
  itemNodes?: string[];
  /** Definition item kinds/texts; default is one requirement + one criterion per Node. */
  items?: Array<{ kind: string; text: string; nodes: string[] }>;
  /** Exclude these Nodes by a scope_exclusion Decision + exclusion item. */
  excludeNodes?: string[];
  /** Replace the exclusion item's decision_ref with this (attack). */
  exclusionDecisionRef?: string;
  /** Make the exclusion item cite these Nodes instead of the Finding's (attack). */
  exclusionItemNodes?: string[];
  /** Add an unresolved Finding related to these Nodes. */
  openFindingNodes?: string[];
  /** Mark a second Finding `resolved` citing the content Decision that does not target it. */
  resolvedByUnrelatedDecision?: boolean;
  /** Challenge area evidence (default cites NOD-001-1). */
  challengeEvidence?: Array<{ kind: 'node'; ref: string }>;
  /** Semantic review area evidence kinds; default node. */
  semanticEvidence?: 'node' | 'none' | 'skill';
}

export interface LeakWorkspace {
  temp: string; root: string; definitionId: string; definitionHash: string; findingId: string; decisionId: string;
  semanticInput: Record<string, unknown>;
}

const at = (statement: string) => ({ single_verifiable_subject: { verdict: 'yes' as const, reason: `단일 결과: ${statement.slice(0, 8)}` }, decomposability: { verdict: 'not_applicable' as const, reason: '추가 분해 대상 없음' }, meaning_preservation: { verdict: 'preserved' as const, confidence: 'high' as const, reason: '조건·행동 보존' } });

export async function buildLeakWorkspace(temp: string, o: LeakOptions = {}): Promise<LeakWorkspace> {
  await rm(temp, { recursive: true, force: true }); await mkdir(temp, { recursive: true });
  await runInit({ cwd: temp, name: 'Leak' }, createMemoryOutput());
  const root = path.join(temp, 'product');
  await mkdir(path.join(temp, 'openspec', 'changes'), { recursive: true });
  await writeFile(path.join(temp, 'openspec', 'config.yaml'), 'schema: spec-driven\n');
  try { execFileSync('ln', ['-s', path.resolve('node_modules'), path.join(temp, 'node_modules')]); } catch { /* exists */ }

  const prompt: Prompt = { id: 'PRM-001', raw_text: RAW, received_at: '2026-10-12T00:00:00Z', content_hash: computePromptHash(RAW), spans: segmentSpans(RAW) };
  await writeFile(path.join(root, 'sources', 'PRM-001.yaml'), stringify(prompt));
  if (o.extraPrompt) {
    const p2: Prompt = { id: 'PRM-002', raw_text: o.extraPrompt, received_at: '2026-10-12T00:00:00Z', content_hash: computePromptHash(o.extraPrompt), spans: segmentSpans(o.extraPrompt) };
    await writeFile(path.join(root, 'sources', 'PRM-002.yaml'), stringify(p2));
  }

  const count = o.decompose ?? SENTENCES.length;
  const stmts = SENTENCES.slice(0, count);
  const steps: ClarificationSteps = {
    definition: [{ term: '주문 확정', meaning: '결제 완료 후 주문을 확정', origin: 'ai_inferred' }],
    decomposition: stmts.map((s, i) => ({ statement: s, span_refs: [`SPN-${String(i + 1).padStart(3, '0')}`] })),
    elaboration: stmts.map((s) => ({ statement: s, actor: '사용자', object: '주문', condition: '결제 완료', action: '주문 확정', result: '주문 확정 상태' })),
    relation_check: [], relation_check_no_items_reason: '각 행동 사이의 필수 의존이나 순서는 원문에 명시되어 있지 않다.',
    counterexample: [], counterexample_no_items_reason: '기록된 조건과 행동을 대조했으며 추가 해석 후보를 발견하지 못했다.',
  };
  const entry = { id: 'IC-001', presented_statement: 'SYNTHETIC: ' + stmts.join(' '), presented_hash: stepsContentHash(steps), prompt_ref: prompt.id, prompt_content_hash: prompt.content_hash, user_response: 'agreed' as const, user_statement: 'SYNTHETIC TEST ONLY: 동의', checked_at: '2026-10-12T00:00:00Z' };
  const { entry_hash: _u, ...stored } = interpretationCheckEntrySchema.parse({ ...entry, entry_hash: '0'.repeat(64) });
  const clarification = clarificationSchema.parse({ id: 'CLR-001', prompt_ref: prompt.id, prompt_content_hash: prompt.content_hash, steps, status: 'confirmed', interpretation_check: [{ ...stored, entry_hash: computeEntryHash(stored) }], finding_candidates: [] });
  await writeFile(path.join(root, 'discovery', 'CLR-001.yaml'), stringify(clarification));

  const nodes: Node[] = stmts.map((s, i) => { const a = at(s); return { id: `NOD-001-${i + 1}`, kind: 'requirement', statement: s, origin: 'source', derived_from: { clarification_ref: 'CLR-001', decomposition_index: i }, structural_signal: { conjunction_count: 0, multiple_predicates: false }, atomicity: { ...a, final: evaluateAtomicityFinal(a) } }; });
  const rv = { verdict: 'preserved' as const, reason: '원문과 대조함' };
  const group = nodeGroupSchema.parse({ id: 'NDG-001', clarification_ref: 'CLR-001', source_content_hash: nodeSetContentHash(steps), clarification_content_hash: clarificationContentHash(clarification), nodes, coverage: { complete: true, uncovered_decomposition_indices: [] }, distortion_checks: stmts.map((s, i) => ({ decomposition_index: i, reconstructed_statement: s, verdict: 'preserved', confidence: 'high', reason: '역합성 일치', condition_preservation: rv, operator_preservation: rv, exception_preservation: rv })), finding_candidates: [], status: 'modeled' });
  await writeFile(path.join(root, 'nodes', 'NDG-001.yaml'), stringify(group));

  const mkFinding = (key: string, statement: string, refs: string[], severity: 'major' | 'critical' = 'major') => appendFindingConfirmation(createFinding({ issue_key: key, type: 'flow_gap', severity, statement, related_refs: refs.map((ref) => ({ kind: 'node' as const, ref })), evidence_refs: [{ kind: 'prompt', ref: prompt.id, detail: '원문 참조' }], counterexamples: [], ai_assessment: { is_ai_judgment: true, rationale: '원문에 없음', confidence: 'medium', uncertainty: ['미확인'] }, questions: ['어떻게 처리하나?'] }), 'confirmed', 'SYNTHETIC USER: 확인', 'SYNTHETIC USER: 검토');
  const finding = mkFinding('k1', '취소 처리 방식이 정의되지 않았다.', ['NOD-001-1']);
  await writeFile(path.join(root, 'findings', `${finding.id}.yaml`), stringify(finding));
  for (const [i, nodeRef] of (o.openFindingNodes ?? []).entries()) { const f = mkFinding(`open-${i}`, `${nodeRef}의 예외 처리가 미정이다.`, [nodeRef]); await writeFile(path.join(root, 'findings', `${f.id}.yaml`), stringify(f)); }

  const { graph } = await readGraphDocument(root); const workspace = await loadGraphWorkspace(root); const candidates = await readRelationCandidates(root);
  // One before-ImpactReport per Node: an Application must carry one for every
  // Node seed its targets touch.
  await mkdir(path.join(root, 'graph', 'reports'), { recursive: true });
  const impactByNode = new Map<string, string>();
  for (const node of nodes) { const impact = computeImpactReport({ seedNodeId: node.id, graphEdges: graph.edges, candidates, workspace, createdAt: new Date().toISOString() }); await writeFile(path.join(root, 'graph', 'reports', `${impact.analysis_id}.yaml`), stringify(impact)); impactByNode.set(node.id, impact.analysis_id); }

  const chEvidence = o.challengeEvidence ?? [{ kind: 'node' as const, ref: 'NOD-001-1' }];
  const ch = await createChallengeRun(root);
  await updateChallengeRun(root, ch.id, (r) => ({ ...r, status: 'complete', areas: Object.fromEntries(challengeAreas.map((a) => [a, { status: 'reviewed', rationale: 'SYNTHETIC AGENT REVIEW', evidence_refs: chEvidence }])) as typeof r.areas, history: [...r.history, { event: 'completed', at: new Date().toISOString(), statement: 'SYNTHETIC: done', content_hash: r.review_hash }] }));

  const cur = await currentChallengeInputs(root); const get = (k: string, r: string) => cur.inputs.find((x) => x.kind === k && x.ref === r)!.content_hash;
  const claim = findingContentHash(toFindingInput(finding)); const nodeHash = get('node', 'NOD-001-1');
  const option = (id: string) => ({ id, description: `SYNTHETIC ${id}`, evidence_refs: [{ kind: 'node' as const, ref: 'NOD-001-1', content_hash: nodeHash }], benefits: ['b'], costs: ['c'], risks: ['r'], assumptions: ['a'], expected_impacts: ['e'], side_effects: ['s'], target_candidates: [{ kind: 'node' as const, ref: 'NOD-001-1', content_hash: nodeHash }], finding_coverage: [{ finding_ref: finding.id, approach: 'x', residual_issues: ['y'] }] });
  const proposal = (await addProposal(root, { finding_refs: [{ finding_ref: finding.id, claim_hash: claim, review_status: 'confirmed' }], input_snapshot: [{ kind: 'node', ref: 'NOD-001-1', content_hash: nodeHash }], options: [option('OPT-A'), option('OPT-B')], ai_recommendation: { is_ai_recommendation: true, option_ref: 'OPT-A', rationale: 'r', confidence: 'medium', uncertainty: ['u'] } })).proposal;
  const promptHash = get('prompt', prompt.id); const findingHash = get('finding', finding.id);
  const decision = (await addDecision(root, { decision_type: 'content_decision', proposal_ref: proposal.id, option_ref: 'OPT-A', finding_refs: [{ finding_ref: finding.id, claim_hash: claim }], selection: { kind: 'proposal_option', proposal_ref: proposal.id, option_ref: 'OPT-A' }, user_statement: 'SYNTHETIC USER: OPT-A', rationale: 'r', scope: 's', input_snapshot: [{ kind: 'prompt', ref: prompt.id, content_hash: promptHash }, { kind: 'node', ref: 'NOD-001-1', content_hash: nodeHash }, { kind: 'finding', ref: finding.id, content_hash: findingHash }, { kind: 'proposal', ref: proposal.id, content_hash: proposal.claim_hash }] })).decision;

  if (o.resolvedByUnrelatedDecision) {
    let f2 = mkFinding('k2', '원문 2~4문장이 정의에서 누락되었다.', ['NOD-001-1']);
    const fh = findingContentHash(toFindingInput(f2));
    const base = { id: 'FHE-' + sha256Hex('x' + f2.id).slice(0, 16), event: 'resolution_recorded' as const, actor: 'change06_decision' as const, prior_review_status: 'confirmed' as const, review_status: 'confirmed' as const, prior_resolution_status: 'unresolved' as const, resolution_status: 'resolved' as const, finding_hash: fh, statement: 'resolved by decision', decision_ref: decision.id, recorded_at: new Date().toISOString() };
    f2 = findingSchema.parse({ ...f2, resolution_status: 'resolved', decision_ref: decision.id, history: [...f2.history, { ...base, entry_hash: findingHistoryEntryHash(base) }] });
    await writeFile(path.join(root, 'findings', `${f2.id}.yaml`), stringify(f2));
  }

  let exclusionDecisionId: string | undefined; let exclusion: { excluded_scope: string; impact: string; residual_risk: string } | undefined;
  if (o.excludeNodes?.length) {
    const critical = mkFinding('excl', `${o.excludeNodes.join(', ')} 범위 결정 필요`, o.excludeNodes, 'critical');
    await writeFile(path.join(root, 'findings', `${critical.id}.yaml`), stringify(critical));
    const cur2 = await currentChallengeInputs(root); const h2 = (k: string, r: string) => cur2.inputs.find((x) => x.kind === k && x.ref === r)!.content_hash;
    exclusion = { excluded_scope: `${o.excludeNodes.join(', ')} 는 이번 범위에서 제외`, impact: '해당 기능 없음', residual_risk: '다음 버전까지 미구현' };
    const dec = (await addDecision(root, { decision_type: 'scope_exclusion', finding_refs: [{ finding_ref: critical.id, claim_hash: findingContentHash(toFindingInput(critical)) }], selection: { kind: 'direct_user_decision', text: 'SYNTHETIC USER: 제외' }, user_statement: 'SYNTHETIC USER: 제외한다', rationale: 'r', scope: 's', scope_exclusion: exclusion, input_snapshot: [{ kind: 'prompt', ref: prompt.id, content_hash: promptHash }, ...o.excludeNodes.map((ref) => ({ kind: 'node', ref, content_hash: h2('node', ref) })), { kind: 'finding', ref: critical.id, content_hash: h2('finding', critical.id) }] })).decision;
    exclusionDecisionId = dec.id;
  }

  const decisionRef = { kind: 'decision', ref: decision.id, content_hash: decision.decision_hash }; const promptRef = { kind: 'prompt', ref: prompt.id, content_hash: promptHash };
  const nodeRef = (ref: string) => ({ kind: 'node', ref, content_hash: get('node', ref) });
  const prov = (refs: string[]) => ({ origin: 'user_decision' as const, source_refs: refs.map(nodeRef), decision_refs: [decisionRef], prompt_refs: [promptRef] });
  const policy = createPolicy({ schema_version: 1, id: 'POL-1111111111111111', context: 'c', actor: 'a', condition_text: 't', condition: { op: 'lte', field: 'f', value_type: 'number', value: 1 }, action: 'a', outcome: 'o', exceptions: [], provenance: prov(['NOD-001-1']) });
  const itemNodes = o.itemNodes ?? nodes.map((n) => n.id).filter((id) => !(o.excludeNodes ?? []).includes(id));
  const specs = o.items ?? itemNodes.flatMap((ref) => { const text = nodes.find((n) => n.id === ref)!.statement; return [{ kind: 'functional_requirement', text, nodes: [ref] }, { kind: 'acceptance_criterion', text: `검증: ${text}`, nodes: [ref] }]; });
  const items: unknown[] = specs.map((x, i) => ({ id: `ITM-${String(i).padStart(12, 'a')}`, kind: x.kind, text: x.text, provenance: prov(x.nodes) }));
  if (exclusion) {
    const decisions = await (await import('../../src/clarification/proposal-decision-store.js')).readDecisions(root); const ex = decisions.find((d) => d.id === exclusionDecisionId)!;
    items.push({ id: 'ITM-eeeeeeeeeeee', kind: 'exclusion', text: exclusion.excluded_scope, provenance: { origin: 'user_decision', source_refs: (o.exclusionItemNodes ?? o.excludeNodes!).map(nodeRef), decision_refs: [{ kind: 'decision', ref: ex.id, content_hash: ex.decision_hash }, decisionRef], prompt_refs: [promptRef] }, exclusion: { decision_ref: o.exclusionDecisionRef ?? ex.id, ...exclusion } });
  }
  const definition = createProductDefinition({ schema_version: 1, status: 'draft', product_name: 'Leak', items: items as never, journey_refs: [], policy_refs: [policy.id], finding_refs: [finding.id], assumption_refs: [], input_snapshot: [promptRef, ...itemNodes.map(nodeRef), decisionRef], rules_version: 'definition/1' });
  const pc = stringify(policy); const dc = stringify(definition);
  const plan = { decision_ref: decision.id, decision_hash: decision.decision_hash, scope: 's', rationale: 'r', targets: [{ ref: { kind: 'policy', ref: policy.id, content_hash: policy.content_hash }, path: `product/policies/${policy.id}.yaml`, before_hash: null, after_hash: sha256Hex(pc), before_content: null, after_content: pc }, { ref: { kind: 'definition', ref: definition.id, content_hash: definition.content_hash }, path: 'product/definition.yaml', before_hash: null, after_hash: sha256Hex(dc), before_content: null, after_content: dc }], finding_refs: [finding.id], residual_risks: ['rr', ...(exclusion ? [exclusion.residual_risk] : [])], before_impact_refs: [...new Set(['NOD-001-1', ...itemNodes, ...(o.exclusionItemNodes ?? o.excludeNodes ?? [])])].map((id) => impactByNode.get(id)!) };
  const app = (await createApplication(root, plan)).application; const applied = await applyApplication(root, app.id);
  await recordApplicationVerification(root, applied.id, { status: 'verified', assessor: 'user', summary: 'SYNTHETIC USER: ok', evidence_refs: [decisionRef], uncertainty: ['synthetic'] });
  if (exclusionDecisionId && !o.exclusionDecisionRef) {
    const decisions = await (await import('../../src/clarification/proposal-decision-store.js')).readDecisions(root); const ex = decisions.find((d) => d.id === exclusionDecisionId)!;
    const plan2 = { ...plan, decision_ref: ex.id, decision_hash: ex.decision_hash, targets: [{ ref: { kind: 'definition', ref: definition.id, content_hash: definition.content_hash }, path: 'product/definition.yaml', before_hash: sha256Hex(dc), after_hash: sha256Hex(dc), before_content: dc, after_content: dc }], finding_refs: [], residual_risks: [exclusion!.residual_risk], before_impact_refs: [...new Set([...itemNodes, ...(o.exclusionItemNodes ?? o.excludeNodes ?? [])])].map((id) => impactByNode.get(id)!) };
    const app2 = (await createApplication(root, plan2)).application; const applied2 = await applyApplication(root, app2.id);
    await recordApplicationVerification(root, applied2.id, { status: 'verified', assessor: 'user', summary: 'SYNTHETIC USER: ok', evidence_refs: [{ kind: 'decision', ref: ex.id, content_hash: ex.decision_hash }], uncertainty: ['synthetic'] });
  }

  const snap = await currentValidationFingerprint(root);
  // Each area cites the artifact kinds AREA_EVIDENCE requires for it.
  const of = (kind: string, ref?: string) => snap.snapshot.find((x) => x.kind === kind && (ref === undefined || x.ref === ref))!;
  const perArea: Record<string, Array<{ kind: string; ref: string; content_hash: string }>> = {
    requirement_completeness: [of('prompt'), of('definition')], user_flow: [of('node', 'NOD-001-1')], policy_consistency: [of('definition'), of('policy')],
    acceptance_criteria: [of('definition')], assumptions: [of('finding', finding.id)], graph_impact: [of('impact_report')], traceability: [of('decision', decision.id), of('prompt')], counterexamples: [of('finding', finding.id)],
  };
  const evidenceFor = (area: string) => o.semanticEvidence === 'none' ? [] : o.semanticEvidence === 'skill' ? [of('skill')] : perArea[area]!;
  const areas = Object.fromEntries(Object.keys(perArea).map((a) => [a, { status: 'reviewed', evidence_refs: evidenceFor(a), rationale: 'SYNTHETIC AGENT REVIEW' }]));
  const item_fidelity = (items as Array<{ id: string; provenance: { source_refs: Array<{ kind: string; ref: string }> } }>).flatMap((item) => item.provenance.source_refs.filter((r) => r.kind === 'node').map((r) => ({ item_ref: item.id, node_ref: r.ref, verdict: 'same', reason: 'SYNTHETIC: item text equals Node text' })));
  const semanticInput = { schema_version: 1, definition_ref: definition.id, definition_hash: definition.content_hash, input_fingerprint: snap.fingerprint, assessor: 'ai', scope: 'all', areas, item_fidelity, unreviewed_scope_resolved: [], finding_refs: [finding.id], unreviewed_scope: [], uncertainty: ['synthetic'], summary: 's', created_at: new Date().toISOString() };
  return { temp, root, definitionId: definition.id, definitionHash: definition.content_hash, findingId: finding.id, decisionId: decision.id, semanticInput };
}
