import { isMeaningfulText } from './text.js';
import { judgeCompletion, clarificationContentHash, type Clarification, type ClarificationSteps } from './clarification.js';
import type { Prompt } from './prompt.js';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { clauseSignalCount } from '../clarification/spans.js';

import { canonicalJson, sha256Hex } from '../clarification/hash.js';

const hashHex = z.string().regex(/^[0-9a-f]{64}$/, 'must be a SHA-256 hex digest');
const confidenceSchema = z.enum(['low', 'medium', 'high']);

export const nodeKindSchema = z.enum(['fact', 'inference', 'requirement', 'policy']);

/**
 * Which decomposition item (by index into Clarification.steps.decomposition)
 * a Node was derived from. Decomposition items have no id of their own
 * (Change 02 did not add one); the index is safe to use here because any
 * reorder of `decomposition` changes `steps`, which changes
 * `source_content_hash`, which forces re-modeling anyway (see the
 * invalidation requirement).
 */
export const nodeDerivedFromSchema = z.object({
  clarification_ref: z.string().regex(/^CLR-\d{3,}$/),
  decomposition_index: z.number().int().nonnegative(),
});

/**
 * Atomicity is three separate judgements, never one. `single_verifiable_subject`
 * decides whether a split is even in question; `decomposability` decides
 * whether a candidate split would orphan a piece; `meaning_preservation`
 * decides whether the chosen outcome (split or not) still says what the
 * source decomposition item said. All three are AI judgements with a reason;
 * `final` is the one thing the CLI derives deterministically from the other
 * three (see `evaluateAtomicity`) — it never re-judges the AI's verdicts.
 */
export const singleVerifiableSubjectSchema = z.object({
  verdict: z.enum(['yes', 'no', 'uncertain']),
  reason: z.string().min(1),
});

export const decomposabilitySchema = z.object({
  verdict: z.enum(['not_applicable', 'valid_split', 'would_orphan_pieces']),
  reason: z.string().min(1),
});

export const meaningPreservationSchema = z.object({
  verdict: z.enum(['preserved', 'distorted', 'uncertain']),
  confidence: confidenceSchema,
  reason: z.string().min(1),
});

export const atomicityFinalSchema = z.enum(['atomic', 'split_required']);

export const atomicitySchema = z.object({
  single_verifiable_subject: singleVerifiableSubjectSchema,
  decomposability: decomposabilitySchema,
  meaning_preservation: meaningPreservationSchema,
  final: atomicityFinalSchema.nullable(),
});

export type Atomicity = z.infer<typeof atomicitySchema>;

/**
 * Deterministically combines the three sub-verdicts into `final`. This is a
 * fixed truth table over values the AI already supplied — it does not
 * evaluate whether those values are *correct*, only what they imply
 * together (Change 03 approval condition 2: CLI never proves the AI's
 * atomicity judgement itself).
 */
export function evaluateAtomicityFinal(
  input: Omit<Atomicity, 'final'>,
): Atomicity['final'] {
  const { single_verifiable_subject, decomposability, meaning_preservation } = input;

  if (meaning_preservation.verdict !== 'preserved') return null;

  if (single_verifiable_subject.verdict === 'yes') {
    return 'atomic';
  }
  if (
    single_verifiable_subject.verdict === 'no' &&
    decomposability.verdict === 'would_orphan_pieces'
  ) {
    // Looks splittable by outcome count, but splitting would orphan a piece
    // (e.g. a compound-condition policy) — stays whole.
    return 'atomic';
  }
  if (
    single_verifiable_subject.verdict === 'no' &&
    decomposability.verdict === 'valid_split'
  ) {
    return 'split_required';
  }
  return null;
}

const addressableConjunctionPattern = /(그리고|하고|,\s*그리고|이고|and)/gi;
const predicatePattern = /(한다|합니다|해야 한다|해야 합니다|해준다|do|does|is|are)\b/gi;

export interface StructuralSignal {
  conjunction_count: number;
  multiple_predicates: boolean;
}

/**
 * Deterministic candidate signal only — counts, never judges. A high count
 * is a "review this for splitting" nudge; it is not evidence that splitting
 * is required, and its absence is not evidence that splitting is unneeded
 * (spec.md: "구조 신호 없이도 의미적으로 분해가 필요한 경우").
 */
export function computeStructuralSignal(statement: string): StructuralSignal {
  const conjunctionMatches = statement.match(addressableConjunctionPattern) ?? [];
  const predicateMatches = statement.match(predicatePattern) ?? [];
  return {
    conjunction_count: conjunctionMatches.length,
    multiple_predicates: predicateMatches.length >= 2,
  };
}

/**
 * Weak, decidable "addition suspected" signal: how much of the Node's own
 * vocabulary (space-separated tokens, 2+ chars) also appears in the source
 * decomposition statement. Low overlap is a candidate to review, never a
 * confirmed error (spec.md: "약한 신호일 뿐 확정 판정이 아니다").
 */
export function computeLexicalOverlapRatio(nodeStatement: string, sourceStatement: string): number {
  const tokenize = (text: string): Set<string> =>
    new Set(text.split(/[\s,.!?()]+/).filter((t) => t.length >= 2));
  const nodeTokens = tokenize(nodeStatement);
  const sourceTokens = tokenize(sourceStatement);
  if (nodeTokens.size === 0) return 1;
  let shared = 0;
  for (const token of nodeTokens) {
    if (sourceTokens.has(token)) shared += 1;
  }
  return shared / nodeTokens.size;
}

/** Below this ratio, flag "addition suspected" as a candidate (not a verdict). */
export const ADDITION_SUSPECT_THRESHOLD = 0.5;

export const nodeSchema = z.object({
  id: z.string().regex(/^NOD-\d{3,}-\d+$/, 'Node id must look like NOD-001-1'),
  kind: nodeKindSchema,
  statement: z.string().min(1),
  split_from: z.string().regex(/^NOD-\d{3,}-\d+$/).optional(),
  origin: z.enum(['source', 'inference']),
  derived_from: nodeDerivedFromSchema,
  structural_signal: z.object({
    conjunction_count: z.number().int().nonnegative(),
    multiple_predicates: z.boolean(),
  }),
  atomicity: atomicitySchema,
});

export type Node = z.infer<typeof nodeSchema>;

export const nodeFindingCandidateSchema = z.object({
  id: z.string().min(1),
  node_ref: z.string().regex(/^NOD-\d{3,}-\d+$/),
  type: z.enum(['addition', 'condition_change', 'operator_change', 'distortion']),
  statement: z.string().min(1),
  status: z.enum(['open', 'resolved', 'deferred', 'dismissed']),
  resolution_ref: z.string().optional(),
});

export type NodeFindingCandidate = z.infer<typeof nodeFindingCandidateSchema>;

/** Only these four types gate `modeled` — a plain ambiguity does not. */
export const BLOCKING_FINDING_TYPES: ReadonlySet<NodeFindingCandidate['type']> = new Set([
  'addition',
  'condition_change',
  'operator_change',
  'distortion',
]);

const preservationReviewSchema = z.object({
  verdict: z.enum(['preserved', 'not_applicable', 'distorted', 'uncertain']),
  reason: z.string().min(1),
});

export const distortionCheckSchema = z.object({
  decomposition_index: z.number().int().nonnegative(),
  reconstructed_statement: z.string().min(1),
  condition_preservation: preservationReviewSchema.optional(),
  operator_preservation: preservationReviewSchema.optional(),
  exception_preservation: preservationReviewSchema.optional(),
  verdict: z.enum(['preserved', 'distorted', 'uncertain']),
  confidence: confidenceSchema,
  reason: z.string().min(1),
});

export type DistortionCheck = z.infer<typeof distortionCheckSchema>;

export const nodeGroupStatusSchema = z.enum(['in_progress', 'needs_review', 'modeled']);

export const coverageSchema = z.object({
  complete: z.boolean(),
  uncovered_decomposition_indices: z.array(z.number().int().nonnegative()),
});

export const nodeGroupSchema = z.object({
  id: z.string().regex(/^NDG-\d{3,}$/, 'NodeGroup id must look like NDG-001'),
  clarification_ref: z.string().regex(/^CLR-\d{3,}$/),
  source_content_hash: hashHex,
  clarification_content_hash: hashHex.optional(),
  nodes: z.array(nodeSchema).default([]),
  retired_nodes: z.array(nodeSchema).optional(),
  coverage: coverageSchema,
  distortion_checks: z.array(distortionCheckSchema).default([]),
  finding_candidates: z.array(nodeFindingCandidateSchema).default([]),
  status: nodeGroupStatusSchema,
});

export type NodeGroup = z.infer<typeof nodeGroupSchema>;

/**
 * Decidable cross-check: a Node claiming `origin: source` must point at a
 * decomposition item that itself has span_refs (i.e. is traceable to the
 * original prompt text). This is a structural consistency check, not a
 * semantic one — it does not confirm the statement is accurate, only that
 * the origin label isn't contradicted by an empty reference list.
 */
export function originMatchesSourceRefs(origin: Node['origin'], decompositionSpanRefs: string[]): boolean {
  if (origin === 'source') return decompositionSpanRefs.length > 0;
  return true;
}

export function parseNodeGroup(yamlText: string): NodeGroup {
  return nodeGroupSchema.parse(parseYaml(yamlText));
}

/** Same algorithm as Change 02's `stepsContentHash` — intentionally identical. */
export function nodeSetContentHash(steps: ClarificationSteps): string {
  return sha256Hex(canonicalJson(steps));
}

export type NodeGroupBlockReason =
  | 'invalid_split_lineage'
  | 'missing_preservation_review'
  | 'invalid_source'
  | 'split_required'
  | 'incomplete_coverage'
  | 'atomicity_undetermined'
  | 'atomicity_final_mismatch'
  | 'open_risk_findings'
  | 'unresolved_distortion_check'
  | 'source_changed_since_modeling'
  | 'structural_signal_mismatch'
  | 'split_review_required'
  | 'invalid_reference';

export type NodeGroupJudgement =
  | { status: 'modeled' }
  | { status: 'needs_review'; reasons: NodeGroupBlockReason[]; detail: string[] };

/**
 * The only authority on whether a NodeGroup is done. Mirrors Change 02's
 * `judgeCompletion()`: never trusts the stored `status`, recomputes
 * coverage, atomicity completeness, open risk findings, and the source hash
 * every call (Constitution 9).
 */
export function judgeNodeSetCompletion(
  group: NodeGroup,
  currentSteps: ClarificationSteps,
  source?: { clarification: Clarification; prompt: Prompt | undefined },
): NodeGroupJudgement {
  const reasons: NodeGroupBlockReason[] = [];
  const detail: string[] = [];

  if (!source || !judgeCompletion(source.clarification, source.prompt).confirmed || source.clarification.id !== group.clarification_ref || nodeSetContentHash(source.clarification.steps) !== nodeSetContentHash(currentSteps)) {
    reasons.push('invalid_source');
    detail.push('Current confirmed Clarification and intact Prompt are required.');
  } else if (group.clarification_content_hash !== clarificationContentHash(source.clarification)) {
    reasons.push('source_changed_since_modeling');
    detail.push('Clarification identity, Prompt binding or confirmation history changed, or source snapshot is missing.');
  }

  const decompositionCount = currentSteps.decomposition.length;

  const allNodes = [...group.nodes, ...(group.retired_nodes ?? [])];
  const invalidRefs = allNodes.filter(
    (n) =>
      n.derived_from.clarification_ref !== group.clarification_ref ||
      n.derived_from.decomposition_index >= decompositionCount ||
      !isMeaningfulText(n.statement) ||
      !originMatchesSourceRefs(n.origin, currentSteps.decomposition[n.derived_from.decomposition_index]?.span_refs ?? []) ||
      ![n.atomicity.single_verifiable_subject.reason, n.atomicity.decomposability.reason, n.atomicity.meaning_preservation.reason].every(isMeaningfulText),
  );
  if (invalidRefs.length > 0 || new Set(allNodes.map(n => n.id)).size !== allNodes.length) {
    reasons.push('invalid_reference');
    detail.push(
      `Nodes with a derived_from that does not resolve: ${invalidRefs.map((n) => n.id).join(', ')}`,
    );
  }

  const retired = group.retired_nodes ?? [];
  const history = new Map(retired.map(n => [n.id, n]));
  const invalidLineage = allNodes.some(n => {
    if (!n.split_from) return false;
    const parent = history.get(n.split_from);
    if (!parent || parent.id === n.id || parent.derived_from.clarification_ref !== n.derived_from.clarification_ref || parent.derived_from.decomposition_index !== n.derived_from.decomposition_index) return true;
    const seen = new Set([n.id]);
    let cursor: Node | undefined = n;
    while (cursor) {
      if (cursor.split_from && seen.has(cursor.split_from)) return true;
      if (cursor.split_from) seen.add(cursor.split_from);
      cursor = cursor.split_from ? history.get(cursor.split_from) : undefined;
    }
    return false;
  }) || retired.some(n => n.atomicity.final !== 'split_required' || evaluateAtomicityFinal(n.atomicity) !== 'split_required' || allNodes.filter(child => child.split_from === n.id).length < 2);
  if (invalidLineage) {
    reasons.push('invalid_split_lineage');
    detail.push('Retired split-required Nodes need at least two new replacements with matching source references and acyclic split_from history.');
  }

  const covered = new Set(
    group.nodes
      .filter((n) => !invalidRefs.includes(n))
      .map((n) => n.derived_from.decomposition_index),
  );
  const uncovered = Array.from({ length: decompositionCount }, (_, i) => i).filter(
    (i) => !covered.has(i),
  );
  if (!decompositionCount || !group.nodes.length || uncovered.length > 0) {
    reasons.push('incomplete_coverage');
    detail.push(`decomposition items not covered by any Node: ${uncovered.join(', ')}`);
  }

  // Structural signals are the CLI's numbers, not the author's. A statement
  // that still carries several clauses cannot be waved through with
  // decomposability: not_applicable — it must be split or defended.
  const signalMismatch = group.nodes.filter(n => { const c = computeStructuralSignal(n.statement); return c.conjunction_count !== n.structural_signal.conjunction_count || c.multiple_predicates !== n.structural_signal.multiple_predicates; });
  if (signalMismatch.length) { reasons.push('structural_signal_mismatch'); detail.push(`structural_signal must equal what the CLI computes from the statement (productkit hash atomicity --input prints it): ${signalMismatch.map(n => n.id).join(', ')}`); }
  const clauseHeavy = group.nodes.filter(n => clauseSignalCount(n.statement) >= 3 && n.atomicity.decomposability.verdict === 'not_applicable');
  if (clauseHeavy.length) { reasons.push('split_review_required'); detail.push(`Nodes whose statement carries 3+ clause separators need decomposability valid_split or would_orphan_pieces with a reason, not not_applicable: ${clauseHeavy.map(n => n.id).join(', ')}`); }
  const splitRequired = group.nodes.filter(n => n.atomicity.final === 'split_required');
  if (splitRequired.length) {
    reasons.push('split_required');
    detail.push(`Final Nodes still require splitting: ${splitRequired.map(n => n.id).join(', ')}`);
  }

  const undetermined = group.nodes.filter((n) => n.atomicity.final === null);
  if (undetermined.length > 0) {
    reasons.push('atomicity_undetermined');
    detail.push(`Nodes without a determined atomicity.final: ${undetermined.map((n) => n.id).join(', ')}`);
  }

  // The AI supplies the three sub-verdicts; `final` is not trusted at face
  // value — the CLI recomputes it with the same fixed rule and flags any
  // Node where the stored `final` does not follow from its own sub-verdicts.
  // This is a structural consistency check, not a re-judgement of the
  // sub-verdicts themselves (condition 2 of the Change 03 approval).
  const mismatched = group.nodes.filter(
    (n) => n.atomicity.final !== null && n.atomicity.final !== evaluateAtomicityFinal(n.atomicity),
  );
  if (mismatched.length > 0) {
    reasons.push('atomicity_final_mismatch');
    detail.push(
      `Nodes whose stored atomicity.final does not follow from their own sub-verdicts: ${mismatched
        .map((n) => n.id)
        .join(', ')}`,
    );
  }

  const nodeIds = new Set(allNodes.map(n => n.id));
  if (group.finding_candidates.some(f => !nodeIds.has(f.node_ref))) {
    reasons.push('invalid_reference');
    detail.push('Finding candidate references a missing Node.');
  }
  const openRisky = group.finding_candidates.filter(
    (f) => f.status === 'open' && BLOCKING_FINDING_TYPES.has(f.type),
  );
  if (openRisky.length > 0) {
    reasons.push('open_risk_findings');
    detail.push(`open risk finding candidates: ${openRisky.map((f) => f.id).join(', ')}`);
  }

  // A distortion_check is a group-level back-composition verdict. It gates
  // completion on its own — the AI is not relying on also having remembered
  // to open a matching finding_candidate (found via real Agent testing: a
  // `distorted`/`uncertain` check with no finding_candidate silently passed
  // before this check existed).
  const unresolvedDistortion = group.distortion_checks.filter((d) => d.verdict !== 'preserved');
  if (unresolvedDistortion.length > 0) {
    reasons.push('unresolved_distortion_check');
    detail.push(
      `distortion_checks not preserved for decomposition index(es): ${unresolvedDistortion
        .map((d) => d.decomposition_index)
        .join(', ')}`,
    );
  }

  const validReview = (d: DistortionCheck) => isMeaningfulText(d.reconstructed_statement) && isMeaningfulText(d.reason) &&
    [d.condition_preservation, d.operator_preservation, d.exception_preservation].every(r => r && ['preserved', 'not_applicable'].includes(r.verdict) && isMeaningfulText(r.reason));
  const reviewed = new Set(group.distortion_checks.filter(d => validReview(d)).map(d => d.decomposition_index));
  if (Array.from({ length: decompositionCount }, (_, i) => i).some(i => !reviewed.has(i)) || group.distortion_checks.some(d => d.decomposition_index >= decompositionCount || !validReview(d)) || new Set(group.distortion_checks.map(d => d.decomposition_index)).size !== group.distortion_checks.length) {
    reasons.push('missing_preservation_review');
    detail.push('Each decomposition item needs one back-composition review covering conditions, logical operators and exceptions.');
  }

  const currentHash = nodeSetContentHash(currentSteps);
  if (currentHash !== group.source_content_hash) {
    reasons.push('source_changed_since_modeling');
    detail.push('Clarification steps changed after this NodeGroup was last modeled');
  }

  if (reasons.length > 0) {
    return { status: 'needs_review', reasons, detail };
  }
  return { status: 'modeled' };
}
