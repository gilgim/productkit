import { validSteps, confirmedFixture, promptFixture, preservedCheck } from './helpers/gate-fixtures.js';
import { clarificationContentHash } from '../src/schema/clarification.js';
import { describe, expect, it } from 'vitest';

import { stepsContentHash, type ClarificationSteps } from '../src/schema/clarification.js';
import {
  ADDITION_SUSPECT_THRESHOLD,
  BLOCKING_FINDING_TYPES,
  computeLexicalOverlapRatio,
  computeStructuralSignal,
  evaluateAtomicityFinal,
  judgeNodeSetCompletion as judgeWithSource,
  nodeGroupSchema,
  nodeSchema,
  nodeSetContentHash,
  originMatchesSourceRefs,
  type Atomicity,
  type Node,
  type NodeGroup,
} from '../src/schema/node.js';

const completeSteps: ClarificationSteps = validSteps(['A single atomic requirement.']);
function judgeNodeSetCompletion(group: NodeGroup, steps: ClarificationSteps) {
  return judgeWithSource(group, steps, { clarification: confirmedFixture(steps), prompt: promptFixture() });
}

function atomicity(overrides: Partial<Atomicity> = {}): Atomicity {
  const base: Atomicity = {
    single_verifiable_subject: { verdict: 'yes', reason: 'one outcome' },
    decomposability: { verdict: 'not_applicable', reason: 'no split considered' },
    meaning_preservation: { verdict: 'preserved', confidence: 'high', reason: 'matches source' },
    final: null,
  };
  const merged = { ...base, ...overrides };
  return { ...merged, final: evaluateAtomicityFinal(merged) };
}

function buildNode(overrides: Partial<Node> = {}): Node {
  const base: Node = {
    id: 'NOD-001-1',
    kind: 'requirement',
    statement: 'A single atomic requirement.',
    origin: 'source',
    derived_from: { clarification_ref: 'CLR-001', decomposition_index: 0 },
    structural_signal: { conjunction_count: 0, multiple_predicates: false },
    atomicity: atomicity(),
  };
  return nodeSchema.parse({ ...base, ...overrides });
}

function buildGroup(overrides: Partial<NodeGroup> = {}): NodeGroup {
  const base: NodeGroup = {
    id: 'NDG-001',
    clarification_ref: 'CLR-001',
    source_content_hash: nodeSetContentHash(completeSteps),
    clarification_content_hash: clarificationContentHash(confirmedFixture(completeSteps)),
    nodes: [buildNode()],
    coverage: { complete: true, uncovered_decomposition_indices: [] },
    distortion_checks: [preservedCheck(0, completeSteps.decomposition[0]!.statement)],
    finding_candidates: [],
    status: 'in_progress',
  };
  return nodeGroupSchema.parse({ ...base, ...overrides });
}

describe('evaluateAtomicityFinal', () => {
  it('[정상] single verifiable subject + preserved meaning => atomic', () => {
    expect(
      evaluateAtomicityFinal({
        single_verifiable_subject: { verdict: 'yes', reason: 'one outcome' },
        decomposability: { verdict: 'not_applicable', reason: '-' },
        meaning_preservation: { verdict: 'preserved', confidence: 'high', reason: '-' },
      }),
    ).toBe('atomic');
  });

  it('[반례 A] multiple outcomes + valid split => split_required', () => {
    expect(
      evaluateAtomicityFinal({
        single_verifiable_subject: { verdict: 'no', reason: 'three independent outcomes' },
        decomposability: { verdict: 'valid_split', reason: 'each piece stands alone' },
        meaning_preservation: { verdict: 'preserved', confidence: 'medium', reason: '-' },
      }),
    ).toBe('split_required');
  });

  it('[반례 B] multiple-looking outcome but splitting would orphan pieces => atomic (stays whole)', () => {
    expect(
      evaluateAtomicityFinal({
        single_verifiable_subject: { verdict: 'no', reason: 'compound condition looks splittable' },
        decomposability: { verdict: 'would_orphan_pieces', reason: 'conditions are each others premise' },
        meaning_preservation: { verdict: 'preserved', confidence: 'high', reason: '-' },
      }),
    ).toBe('atomic');
  });

  it('[경계] uncertain single_verifiable_subject never auto-decides', () => {
    expect(
      evaluateAtomicityFinal({
        single_verifiable_subject: { verdict: 'uncertain', reason: 'not sure how many outcomes' },
        decomposability: { verdict: 'not_applicable', reason: '-' },
        meaning_preservation: { verdict: 'preserved', confidence: 'low', reason: '-' },
      }),
    ).toBeNull();
  });

  it('[경계] distorted meaning preservation blocks atomic even if split looked valid', () => {
    expect(
      evaluateAtomicityFinal({
        single_verifiable_subject: { verdict: 'no', reason: 'three outcomes' },
        decomposability: { verdict: 'valid_split', reason: 'each piece stands alone' },
        meaning_preservation: { verdict: 'distorted', confidence: 'medium', reason: 'shared trigger lost' },
      }),
    ).toBeNull();
  });
});

describe('computeStructuralSignal', () => {
  it('counts candidate conjunctions without judging whether to split', () => {
    const signal = computeStructuralSignal('결제가 완료되면 주문을 확정하고, 이메일을 보내고, 재고를 차감한다');
    expect(signal.conjunction_count).toBeGreaterThan(0);
  });

  it('absence of conjunctions is not evidence that splitting is unneeded', () => {
    const signal = computeStructuralSignal('이름과이메일을입력해야한다');
    expect(signal.conjunction_count).toBe(0);
    // The function only counts; it never claims "no signal = atomic".
  });
});

describe('computeLexicalOverlapRatio / addition suspicion', () => {
  it('high overlap does not flag addition', () => {
    const ratio = computeLexicalOverlapRatio('마감일을 설정할 수 있다', '할 일을 추가할 때 마감일을 설정할 수 있다');
    expect(ratio).toBeGreaterThanOrEqual(ADDITION_SUSPECT_THRESHOLD);
  });

  it('[반례] low overlap flags a new, ungrounded requirement as suspect', () => {
    const ratio = computeLexicalOverlapRatio(
      '완료된 할 일은 자동으로 삭제된다',
      '할 일을 추가할 때 마감일을 설정할 수 있다',
    );
    expect(ratio).toBeLessThan(ADDITION_SUSPECT_THRESHOLD);
  });
});

describe('originMatchesSourceRefs', () => {
  it('source origin requires non-empty span_refs', () => {
    expect(originMatchesSourceRefs('source', [])).toBe(false);
    expect(originMatchesSourceRefs('source', ['SPN-001'])).toBe(true);
  });

  it('inference origin is unaffected by span_refs', () => {
    expect(originMatchesSourceRefs('inference', [])).toBe(true);
  });
});

describe('nodeSetContentHash', () => {
  it('uses the same algorithm as Change 02 stepsContentHash', () => {
    expect(nodeSetContentHash(completeSteps)).toBe(stepsContentHash(completeSteps));
  });
});

describe('judgeNodeSetCompletion', () => {
  it('[정상] full coverage, determined atomicity, no open risk findings, matching hash => modeled', () => {
    expect(judgeNodeSetCompletion(buildGroup(), completeSteps)).toEqual({ status: 'modeled' });
  });

  it('[반례] a decomposition item not covered by any Node blocks completion', () => {
    const steps: ClarificationSteps = {
      ...completeSteps,
      decomposition: [...completeSteps.decomposition, { statement: 'A second item.', span_refs: [] }],
    };
    const group = buildGroup({ source_content_hash: nodeSetContentHash(steps) });
    const result = judgeNodeSetCompletion(group, steps);
    expect(result.status).toBe('needs_review');
    expect((result as { reasons: string[] }).reasons).toContain('incomplete_coverage');
  });

  it('[반례] a Node whose stored final contradicts its own sub-verdicts is flagged (CLI recomputes, never trusts final as-is)', () => {
    const inconsistentNode = buildNode({
      atomicity: {
        single_verifiable_subject: { verdict: 'no', reason: 'three outcomes' },
        decomposability: { verdict: 'valid_split', reason: 'each stands alone' },
        meaning_preservation: { verdict: 'distorted', confidence: 'medium', reason: 'trigger lost' },
        final: 'atomic', // asserted, but these sub-verdicts actually combine to null
      },
    });
    const group = buildGroup({ nodes: [inconsistentNode] });
    const result = judgeNodeSetCompletion(group, completeSteps);
    expect(result.status).toBe('needs_review');
    expect((result as { reasons: string[] }).reasons).toContain('atomicity_final_mismatch');
  });

  it('[반례] an undetermined atomicity.final blocks completion (단일 검증 대상 불확실)', () => {
    const uncertainNode = buildNode({
      atomicity: atomicity({
        single_verifiable_subject: { verdict: 'uncertain', reason: 'unclear' },
      }),
    });
    const group = buildGroup({ nodes: [uncertainNode] });
    const result = judgeNodeSetCompletion(group, completeSteps);
    expect(result.status).toBe('needs_review');
    expect((result as { reasons: string[] }).reasons).toContain('atomicity_undetermined');
  });

  it('[반례] an open addition finding candidate blocks completion', () => {
    const group = buildGroup({
      finding_candidates: [
        {
          id: 'NFC-001',
          node_ref: 'NOD-001-1',
          type: 'addition',
          statement: 'ungrounded requirement suspected',
          status: 'open',
        },
      ],
    });
    const result = judgeNodeSetCompletion(group, completeSteps);
    expect(result.status).toBe('needs_review');
    expect((result as { reasons: string[] }).reasons).toContain('open_risk_findings');
  });

  it('a resolved finding candidate of a blocking type does not block completion', () => {
    const group = buildGroup({
      finding_candidates: [
        {
          id: 'NFC-001',
          node_ref: 'NOD-001-1',
          type: 'condition_change',
          statement: 'condition scope narrowed',
          status: 'resolved',
          resolution_ref: 'DEC-001',
        },
      ],
    });
    expect(judgeNodeSetCompletion(group, completeSteps)).toEqual({ status: 'modeled' });
  });

  it('[경계] a general ambiguity left on the source Clarification (not a Node finding) does not block modeling', () => {
    const stepsWithLeftoverAmbiguity = completeSteps; // Clarification-level ambiguity lives elsewhere (Change 02 schema),
    // never inside NodeGroup.finding_candidates — only the four risk types can appear there by schema.
    expect(judgeNodeSetCompletion(buildGroup(), stepsWithLeftoverAmbiguity)).toEqual({ status: 'modeled' });
    // BLOCKING_FINDING_TYPES covers exactly the four risk types, nothing broader.
    expect(BLOCKING_FINDING_TYPES.size).toBe(4);
  });

  it('[Clarification 변경 후 무효화] a changed source invalidates a NodeGroup regardless of its stored status', () => {
    const changedSteps: ClarificationSteps = {
      ...completeSteps,
      decomposition: [{ statement: 'A changed requirement.', span_refs: ['SPN-001'] }],
    };
    const group = buildGroup({ status: 'modeled' }); // file claims modeled
    const result = judgeNodeSetCompletion(group, changedSteps);
    expect(result.status).toBe('needs_review');
    expect((result as { reasons: string[] }).reasons).toContain('source_changed_since_modeling');
  });

  it('[실제 Agent 검증에서 발견] a distorted group-level distortion_check blocks completion even with no matching finding_candidate', () => {
    const group = buildGroup({
      distortion_checks: [
        {
          decomposition_index: 0,
          reconstructed_statement: 'y',
          verdict: 'distorted',
          confidence: 'high',
          reason: 'group-level says distorted',
        },
      ],
      finding_candidates: [], // deliberately no matching finding_candidate
    });
    const result = judgeNodeSetCompletion(group, completeSteps);
    expect(result.status).toBe('needs_review');
    expect((result as { reasons: string[] }).reasons).toContain('unresolved_distortion_check');
  });

  it('an uncertain (not just distorted) distortion_check also blocks completion', () => {
    const group = buildGroup({
      distortion_checks: [
        { decomposition_index: 0, reconstructed_statement: 'y', verdict: 'uncertain', confidence: 'low', reason: '-' },
      ],
    });
    expect(judgeNodeSetCompletion(group, completeSteps).status).toBe('needs_review');
  });

  it('a preserved distortion_check does not block completion', () => {
    const group = buildGroup({
      distortion_checks: [
        preservedCheck(0, 'A single atomic requirement.'),
      ],
    });
    expect(judgeNodeSetCompletion(group, completeSteps)).toEqual({ status: 'modeled' });
  });

  it('[Node 참조 무결성] a Node pointing at an out-of-range decomposition_index is flagged, not silently ignored', () => {
    const badNode = buildNode({ derived_from: { clarification_ref: 'CLR-001', decomposition_index: 9 } });
    const group = buildGroup({ nodes: [badNode] });
    const result = judgeNodeSetCompletion(group, completeSteps);
    expect(result.status).toBe('needs_review');
    expect((result as { reasons: string[] }).reasons).toContain('invalid_reference');
    // And it must not be silently counted as covering decomposition index 0 either.
    expect((result as { reasons: string[] }).reasons).toContain('incomplete_coverage');
  });

  it('[Node 참조 무결성] a Node pointing at a different Clarification is flagged', () => {
    const badNode = buildNode({ derived_from: { clarification_ref: 'CLR-999', decomposition_index: 0 } });
    const group = buildGroup({ nodes: [badNode] });
    const result = judgeNodeSetCompletion(group, completeSteps);
    expect(result.status).toBe('needs_review');
    expect((result as { reasons: string[] }).reasons).toContain('invalid_reference');
  });
});
