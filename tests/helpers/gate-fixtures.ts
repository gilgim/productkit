import { clarificationContentHash, clarificationSchema, interpretationCheckEntrySchema, computeEntryHash, renderPresentation, stepsContentHash, type ClarificationSteps } from '../../src/schema/clarification.js';
import { computePromptHash, type Prompt } from '../../src/schema/prompt.js';
import { segmentSpans } from '../../src/clarification/spans.js';

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Tests have no terminal, so they switch the workspace to `attestation: flag`
 * the same way a user would — by editing config.yaml. The gate then WARNs on
 * every report, which is the intended visible trace of that choice.
 */
export async function allowFlagAttestation(productRoot: string): Promise<void> {
  const file = path.join(productRoot, 'config.yaml');
  const text = await readFile(file, 'utf8');
  await writeFile(file, text.replace(/^attestation:\s*tty\s*$/m, 'attestation: flag'));
}

// All confirmations in this helper are SYNTHETIC TEST DATA, never user consent.
export function promptFixture(raw_text = '사용자가 결제를 완료하면 주문을 확정한다.'): Prompt {
  return { id: 'PRM-001', raw_text, received_at: '2026-10-12T00:00:00Z', content_hash: computePromptHash(raw_text), spans: segmentSpans(raw_text) };
}
export function validSteps(statements = ['사용자가 결제를 완료하면 주문을 확정한다.']): ClarificationSteps {
  return {
    definition: [{ term: '주문 확정', meaning: '결제 완료 후 주문을 확정하는 행동', origin: 'ai_inferred' }],
    decomposition: statements.map(statement => ({ statement, span_refs: ['SPN-001'] })),
    elaboration: statements.map(statement => ({ statement, actor: '사용자', object: '주문', condition: '결제 완료', action: '주문 확정', result: '주문 확정 상태' })),
    relation_check: [], relation_check_no_items_reason: '각 행동 사이의 필수 의존이나 순서는 원문에 명시되어 있지 않다.',
    counterexample: [], counterexample_no_items_reason: '기록된 조건과 행동을 대조했으며 추가 해석 후보를 발견하지 못했다.',
  };
}
export function confirmedFixture(steps = validSteps(), prompt = promptFixture()) {
  // The presented statement is rendered by the CLI, never written by hand.
  const entry = { id: 'IC-TEST-001', presented_statement: renderPresentation({ steps, finding_candidates: [] }, prompt), presented_hash: stepsContentHash(steps), prompt_ref: prompt.id, prompt_content_hash: prompt.content_hash, user_response: 'agreed' as const, user_statement: 'SYNTHETIC TEST ONLY: 이 해석에 동의합니다.', checked_at: '2026-10-12T00:00:00Z' };
  const { entry_hash: _unused, ...storedEntry } = interpretationCheckEntrySchema.parse({ ...entry, entry_hash: '0'.repeat(64) });
  return clarificationSchema.parse({ id: 'CLR-001', prompt_ref: prompt.id, prompt_content_hash: prompt.content_hash, steps, status: 'confirmed', interpretation_check: [{ ...storedEntry, entry_hash: computeEntryHash(storedEntry) }], finding_candidates: [] });
}

import { nodeGroupSchema, nodeSetContentHash, evaluateAtomicityFinal, type Atomicity, type Node } from '../../src/schema/node.js';
export function atomicNodeFixture(statement = validSteps().decomposition[0]!.statement): Node {
  const atomicity: Atomicity = { single_verifiable_subject: { verdict: 'yes', reason: '단일 결과' }, decomposability: { verdict: 'not_applicable', reason: '추가 분해 대상 없음' }, meaning_preservation: { verdict: 'preserved', confidence: 'high', reason: '공유 조건을 보존함' }, final: 'atomic' };
  return { id: 'NOD-001-1', kind: 'requirement', statement, origin: 'source', derived_from: { clarification_ref: 'CLR-001', decomposition_index: 0 }, structural_signal: { conjunction_count: 0, multiple_predicates: false }, atomicity: { ...atomicity, final: evaluateAtomicityFinal(atomicity) } };
}
export function preservedCheck(index: number, statement: string) {
  const review = { verdict: 'preserved' as const, reason: '원문과 재합성 내용을 비교했다.' };
  return { decomposition_index: index, reconstructed_statement: statement, verdict: 'preserved' as const, confidence: 'high' as const, reason: '역합성이 출처 조건과 행동을 유지함', condition_preservation: review, operator_preservation: review, exception_preservation: review };
}
export function groupFixture(steps = validSteps(), nodes = [atomicNodeFixture()]) {
  return nodeGroupSchema.parse({ id: 'NDG-001', clarification_ref: 'CLR-001', source_content_hash: nodeSetContentHash(steps), clarification_content_hash: clarificationContentHash(confirmedFixture(steps)), nodes, coverage: { complete: true, uncovered_decomposition_indices: [] }, distortion_checks: steps.decomposition.map((s,i) => preservedCheck(i,s.statement)), finding_candidates: [], status: 'modeled' });
}
