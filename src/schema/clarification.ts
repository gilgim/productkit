import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import { promptIntegrityIssue, type Prompt } from './prompt.js';
import { isMeaningfulText } from './text.js';
import { clauseSignalCount, spanText } from '../clarification/spans.js';

import { canonicalJson, sha256Hex } from '../clarification/hash.js';

const hashHex = z.string().regex(/^[0-9a-f]{64}$/, 'must be a SHA-256 hex digest');

/**
 * The six Clarification steps. `origin` on a definition item separates what
 * the user actually said from what the AI inferred — neither CLI nor spec
 * can verify that a `user_stated` entry is truthful; it only records which
 * bucket the author put it in (Constitution 2, 4).
 */
export const definitionItemSchema = z.object({
  term: z.string().min(1),
  meaning: z.string().min(1),
  origin: z.enum(['user_stated', 'ai_inferred']),
});

export const decompositionItemSchema = z.object({
  statement: z.string().min(1),
  span_refs: z.array(z.string().min(1)),
  /** Required when span_refs has more than one entry: why these sentences are one requirement. */
  merge_reason: z.string().optional(),
  /** Required when this item is the only reading of a span that carries several clauses: why one statement is enough. */
  single_statement_reason: z.string().optional(),
});

export const elaborationItemSchema = z.object({
  statement: z.string().min(1),
  actor: z.string().optional(),
  object: z.string().optional(),
  condition: z.string().optional(),
  action: z.string().optional(),
  result: z.string().optional(),
});

/**
 * A candidate relation, not a Graph edge. Change 04 owns typed, validated
 * edges; this change only records "these two statements look related".
 */
export const relationCheckItemSchema = z.object({
  statement_a: z.string().min(1),
  statement_b: z.string().min(1),
  relation_candidate: z.string().min(1),
});

export const counterexampleItemSchema = z.object({
  ambiguity: z.string().min(1),
  possible_interpretations: z.array(z.string().min(1)),
});

/**
 * A Prompt span that no decomposition item or finding candidate references.
 * The only legal reason is that the span carries no requirement (a heading,
 * an analogy, a worked example, narrative). Listing it here is the author's
 * claim; it sits inside `steps` so the user agrees to it along with the
 * decomposition (Constitution 11).
 */
export const spanCoverageItemSchema = z.object({
  span_ref: z.string().min(1),
  disposition: z.literal('non_requirement'),
  reason: z.string().min(1),
});

export const clarificationStepsSchema = z.object({
  definition: z.array(definitionItemSchema).default([]),
  decomposition: z.array(decompositionItemSchema).default([]),
  elaboration: z.array(elaborationItemSchema).default([]),
  relation_check: z.array(relationCheckItemSchema).default([]),
  counterexample: z.array(counterexampleItemSchema).default([]),
  relation_check_no_items_reason: z.string().optional(),
  counterexample_no_items_reason: z.string().optional(),
  // Optional, not defaulted: a missing key must hash the same as before so
  // Clarifications confirmed under earlier rules stay hash-stable and fail
  // the coverage rule below for the real reason, not "content changed".
  span_coverage: z.array(spanCoverageItemSchema).optional(),
});

export type ClarificationSteps = z.infer<typeof clarificationStepsSchema>;

/**
 * One round of interpretation confirmation. `presented_hash` is the hash of
 * the *steps* at the time this entry was written (not of the prose summary)
 * — so if steps change after a round is agreed to, the next judgement sees a
 * mismatch and cannot treat the old agreement as still covering the new
 * content (design.md D7). `entry_hash` guards this entry's own fields
 * against being edited after the fact; it detects such a change, it does
 * not prevent someone from editing the file, and it says nothing about
 * whether `user_statement` is genuinely the user's words.
 */
export const interpretationCheckEntrySchema = z.object({
  id: z.string().min(1),
  presented_statement: z.string().min(1),
  presented_hash: hashHex,
  prompt_ref: z.string().regex(/^PRM-\d{3,}$/).optional(),
  prompt_content_hash: hashHex.optional(),
  user_response: z.enum(['agreed', 'disagreed', 'partially_agreed']),
  user_statement: z.string(),
  checked_at: z.string().min(1),
  entry_hash: hashHex,
});

export type InterpretationCheckEntry = z.infer<typeof interpretationCheckEntrySchema>;

export const findingCandidateSchema = z.object({
  statement: z.string().min(1),
  type: z.enum(['ambiguity', 'contradiction', 'missing_premise']),
  span_refs: z.array(z.string().min(1)),
});

export type FindingCandidate = z.infer<typeof findingCandidateSchema>;

export const clarificationStatusSchema = z.enum([
  'in_progress',
  'awaiting_confirmation',
  'confirmed',
]);

export const clarificationSchema = z.object({
  id: z.string().regex(/^CLR-\d{3,}$/, 'Clarification id must look like CLR-001'),
  prompt_ref: z.string().regex(/^PRM-\d{3,}$/, 'prompt_ref must look like PRM-001'),
  prompt_content_hash: hashHex.optional(),
  steps: clarificationStepsSchema,
  status: clarificationStatusSchema,
  interpretation_check: z.array(interpretationCheckEntrySchema).default([]),
  finding_candidates: z.array(findingCandidateSchema).default([]),
});

export type Clarification = z.infer<typeof clarificationSchema>;

export function parseClarification(yamlText: string): Clarification {
  return clarificationSchema.parse(parseYaml(yamlText));
}

/** Normalized hash of the steps shown to the user — not of the prose summary. */
export function stepsContentHash(steps: ClarificationSteps): string {
  return sha256Hex(canonicalJson(steps));
}

/**
 * Same as `stepsContentHash`, but takes the Clarification artifact's raw
 * YAML text directly. This exists so an Agent writing the artifact never
 * needs its own dependency on the `yaml` package — a consuming app's
 * node_modules layout does not guarantee `yaml` is resolvable from its own
 * root (it may be nested under productkit's own node_modules rather than
 * hoisted). Parsing happens inside productkit, where `yaml` is always
 * resolvable regardless of the consumer's dependency tree.
 */
export function stepsContentHashFromYaml(clarificationYamlText: string): string {
  const parsed = clarificationSchema.shape.steps.parse(
    (parseYaml(clarificationYamlText) as { steps: unknown }).steps,
  );
  return stepsContentHash(parsed);
}

/** Guards one interpretation_check entry against being edited after the fact. */
export function computeEntryHash(entry: Omit<InterpretationCheckEntry, 'entry_hash'>): string {
  return sha256Hex(canonicalJson(entry));
}

export type CompletionBlockReason =
  | 'no_confirmation'
  | 'not_agreed'
  | 'missing_user_statement'
  | 'content_changed_since_confirmation'
  | 'integrity_violation'
  | 'incomplete_steps'
  | 'invalid_step_reference'
  | 'missing_prompt'
  | 'invalid_prompt_reference'
  | 'prompt_integrity_violation'
  | 'prompt_changed_since_clarification'
  | 'uncovered_spans'
  | 'missing_merge_reason'
  | 'presented_statement_not_rendered';

export type CompletionJudgement =
  | { confirmed: true }
  | { confirmed: false; reason: CompletionBlockReason; detail?: string };

/**
 * The only authority on whether a Clarification is done. Never trusts the
 * file's own `status` field — recomputes from `steps` and
 * `interpretation_check` every call, the same way config.yaml's `stages`
 * are progress notes rather than verdicts (Constitution 9).
 */
export function judgeCompletion(clarification: Clarification, prompt?: Prompt): CompletionJudgement {
  for (const entry of clarification.interpretation_check) {
    const { entry_hash, ...rest } = entry;
    if (computeEntryHash(rest) !== entry_hash) {
      return {
        confirmed: false,
        reason: 'integrity_violation',
        detail: `interpretation_check entry ${entry.id} no longer matches its entry_hash`,
      };
    }
  }

  const latest = clarification.interpretation_check.at(-1);
  if (!latest) {
    return { confirmed: false, reason: 'no_confirmation' };
  }
  if (latest.user_response !== 'agreed') {
    return { confirmed: false, reason: 'not_agreed' };
  }
  if (latest.user_statement.trim().length === 0) {
    return { confirmed: false, reason: 'missing_user_statement' };
  }

  const currentHash = stepsContentHash(clarification.steps);
  if (latest.presented_hash !== currentHash) {
    return {
      confirmed: false,
      reason: 'content_changed_since_confirmation',
      detail: `steps changed after entry ${latest.id} was agreed to; re-confirmation is required`,
    };
  }

  const issue = clarificationStepsIssue(clarification.steps);
  if (issue) return issue;
  if (!isMeaningfulText(latest.presented_statement) || !isMeaningfulText(latest.user_statement)) {
    return { confirmed: false, reason: 'incomplete_steps', detail: 'Interpretation and user statement must not be placeholders.' };
  }
  if (!prompt) return { confirmed: false, reason: 'missing_prompt' };
  if (prompt.id !== clarification.prompt_ref || latest.prompt_ref !== clarification.prompt_ref) return { confirmed: false, reason: 'invalid_prompt_reference' };
  const promptIssue = promptIntegrityIssue(prompt);
  if (promptIssue) return { confirmed: false, reason: 'prompt_integrity_violation', detail: promptIssue };
  if (clarification.prompt_content_hash !== prompt.content_hash || latest.prompt_content_hash !== prompt.content_hash) return { confirmed: false, reason: 'prompt_changed_since_clarification', detail: 'Missing or stale Prompt snapshot; review against the current original and obtain a new confirmation.' };
  const spanIds = new Set(prompt.spans.map(s => s.id));
  if (clarification.steps.decomposition.some(d => d.span_refs.some(ref => !spanIds.has(ref))) || clarification.finding_candidates.some(f => f.span_refs.some(ref => !spanIds.has(ref))) || (clarification.steps.span_coverage ?? []).some(c => !spanIds.has(c.span_ref))) return { confirmed: false, reason: 'invalid_step_reference', detail: 'A source span reference does not resolve in the current Prompt.' };
  const uncovered = uncoveredSpans(clarification, prompt);
  if (uncovered.length) return { confirmed: false, reason: 'uncovered_spans', detail: `Prompt spans not decomposed, not raised as a finding candidate, and not dispositioned as non_requirement: ${uncovered.join(', ')}` };
  const merge = mergeReasonIssue(clarification, prompt);
  if (merge) return { confirmed: false, reason: 'missing_merge_reason', detail: merge };
  if (squash(latest.presented_statement) !== squash(renderPresentation(clarification, prompt))) return { confirmed: false, reason: 'presented_statement_not_rendered', detail: 'presented_statement must be exactly the text `productkit clarify` renders from the current steps (run it and copy the block verbatim).' };
  return { confirmed: true };
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
const spanTextById = (prompt: Prompt, id: string): string => { const span = prompt.spans.find(s => s.id === id); return span ? spanText(prompt.raw_text, span) : '(span not found)'; };

/**
 * The text the user is asked to agree to is rendered by the CLI, not written
 * by the agent. It pairs every decomposed span with its reading, lists every
 * span set aside with its reason, and lists every finding candidate with its
 * spans. The agent can choose the readings and reasons; it cannot choose what
 * the user sees or hide a span behind a summary. `judgeCompletion` requires
 * `presented_statement` to equal this render exactly.
 */
export function renderPresentation(clarification: Pick<Clarification, 'steps' | 'finding_candidates'>, prompt: Prompt): string {
  const lines: string[] = [];
  clarification.steps.decomposition.forEach((item, i) => {
    lines.push(`[${i + 1}] 원문 ${item.span_refs.join(', ')}: ${item.span_refs.map(id => `"${spanTextById(prompt, id)}"`).join(' / ')}`);
    if (item.span_refs.length > 1) lines.push(`    묶은 이유: ${squash(item.merge_reason ?? '')}`);
    if (item.single_statement_reason) lines.push(`    한 문장으로 읽은 이유: ${squash(item.single_statement_reason)}`);
    lines.push(`    해석: ${squash(item.statement)}`);
  });
  const aside = clarification.steps.span_coverage ?? [];
  lines.push(aside.length ? `요구사항 아님 (${aside.length}):` : '요구사항 아님: 없음');
  for (const c of aside) lines.push(`  - ${c.span_ref} "${spanTextById(prompt, c.span_ref)}" — ${squash(c.reason)}`);
  const candidates = clarification.finding_candidates;
  lines.push(candidates.length ? `질문으로 남김 (${candidates.length}):` : '질문으로 남김: 없음');
  candidates.forEach((f, i) => lines.push(`  - [Q${i + 1}] ${f.span_refs.join(', ')} ${f.span_refs.map(id => `"${spanTextById(prompt, id)}"`).join(' / ')} — ${f.type}: ${squash(f.statement)}`));
  return lines.join('\n');
}

/** A span carrying this many clause separators, read as one statement, needs a stated reason. */
export const CLAUSE_SIGNAL_THRESHOLD = 3;

/**
 * Where requirements get merged away: one item citing several spans, or one
 * item being the only reading of a span that plainly carries several
 * clauses. Neither is forbidden; both need a reason the user will see.
 */
export function mergeReasonIssue(clarification: Pick<Clarification, 'steps'>, prompt: Prompt): string | undefined {
  const items = clarification.steps.decomposition;
  for (const [i, item] of items.entries()) {
    if (item.span_refs.length > 1 && !isMeaningfulText(item.merge_reason)) return `decomposition[${i}] cites ${item.span_refs.length} spans (${item.span_refs.join(', ')}) but gives no merge_reason.`;
    if (item.span_refs.length === 1) {
      const id = item.span_refs[0]!;
      const readers = items.filter(other => other.span_refs.includes(id));
      const signals = clauseSignalCount(spanTextById(prompt, id));
      if (readers.length === 1 && signals >= CLAUSE_SIGNAL_THRESHOLD && !isMeaningfulText(item.single_statement_reason)) return `decomposition[${i}] is the only reading of ${id}, which carries ${signals} clause separators; give a single_statement_reason or split it.`;
    }
  }
  return undefined;
}

/**
 * Every span of the Prompt must land somewhere: in a decomposition statement,
 * in a finding candidate, or in `span_coverage` with a reason (Constitution
 * 11). This is the reverse direction of span_refs: span_refs prove that what
 * was decomposed came from the Prompt; this proves that nothing in the Prompt
 * was silently skipped. The CLI cannot judge whether a `non_requirement`
 * reason is right — only that each skipped span was named and reasoned.
 */
export function uncoveredSpans(clarification: Clarification, prompt: Prompt): string[] {
  const covered = new Set<string>();
  for (const d of clarification.steps.decomposition) for (const ref of d.span_refs) covered.add(ref);
  for (const f of clarification.finding_candidates) for (const ref of f.span_refs) covered.add(ref);
  for (const c of clarification.steps.span_coverage ?? []) if (isMeaningfulText(c.reason)) covered.add(c.span_ref);
  return prompt.spans.map(s => s.id).filter(id => !covered.has(id));
}

/** Completion requirements are stricter than parsing an editable, unfinished draft. */
export function clarificationStepsIssue(steps: ClarificationSteps): Extract<CompletionJudgement, { confirmed: false }> | undefined {
  const incomplete = (detail: string) => ({ confirmed: false as const, reason: 'incomplete_steps' as const, detail });
  if (!clarificationStepsSchema.safeParse(steps).success) return incomplete('Invalid step structure.');
  if (!steps.definition.length || steps.definition.some(d => !isMeaningfulText(d.term) || !isMeaningfulText(d.meaning))) return incomplete('Definition requires substantive term/meaning records.');
  if (!steps.decomposition.length || steps.decomposition.some(d => !isMeaningfulText(d.statement) || !d.span_refs.length || d.span_refs.some(r => !isMeaningfulText(r)))) return incomplete('Decomposition requires statements with source span references.');
  if (!steps.elaboration.length || steps.elaboration.some(e => [e.statement, e.actor, e.object, e.condition, e.action, e.result].some(v => !isMeaningfulText(v)))) return incomplete('Elaboration requires statement, actor, object, condition, action and result.');
  const statements = new Set(steps.decomposition.map(d => d.statement));
  if (steps.elaboration.some(e => !statements.has(e.statement)) || steps.decomposition.some(d => !steps.elaboration.some(e => e.statement === d.statement))) return { confirmed: false, reason: 'invalid_step_reference', detail: 'Elaboration must reference and cover decomposition statements exactly.' };
  for (const relation of steps.relation_check) {
    if (![relation.statement_a, relation.statement_b, relation.relation_candidate].every(isMeaningfulText)) return incomplete('Relation review contains a placeholder.');
    if (!statements.has(relation.statement_a) || !statements.has(relation.statement_b) || relation.statement_a === relation.statement_b) return { confirmed: false, reason: 'invalid_step_reference', detail: 'Relation review must reference two distinct decomposition statements.' };
  }
  if (!steps.relation_check.length && !isMeaningfulText(steps.relation_check_no_items_reason)) return incomplete('Relation review requires candidates or an explicit reviewed-no-items reason.');
  if (steps.relation_check.length && steps.relation_check_no_items_reason !== undefined) return incomplete('Relation review cannot have candidates and a no-items assertion together.');
  if (steps.counterexample.some(c => !isMeaningfulText(c.ambiguity) || c.possible_interpretations.length < 2 || c.possible_interpretations.some(v => !isMeaningfulText(v)))) return incomplete('Counterexample requires an ambiguity and at least two substantive interpretations.');
  if (!steps.counterexample.length && !isMeaningfulText(steps.counterexample_no_items_reason)) return incomplete('Counterexample review requires records or an explicit reviewed-no-items reason.');
  if (steps.counterexample.length && steps.counterexample_no_items_reason !== undefined) return incomplete('Counterexample review cannot have records and a no-items assertion together.');
  return undefined;
}

/** NodeGroup binds to source identity, Prompt version and confirmation history, not only steps. */
export function clarificationContentHash(clarification: Clarification): string {
  const { status: _status, ...content } = clarification;
  return sha256Hex(canonicalJson(content));
}
