import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { promptIntegrityIssue } from './prompt.js';
import { forbiddenTextIssue, isMeaningfulText } from './text.js';
import { clauseSignalCount, contentTokenList, contentTokens, isStructuralSpan, lcsLength, numberTokens, polarityTokens, spanText } from '../clarification/spans.js';
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
    /** Where user_statement came from; absent on entries written before `productkit clarify confirm` existed. */
    attestation: z.enum(['tty', 'flag']).optional(),
    checked_at: z.string().min(1),
    entry_hash: hashHex,
});
export const findingCandidateSchema = z.object({
    statement: z.string().min(1),
    type: z.enum(['ambiguity', 'contradiction', 'missing_premise']),
    span_refs: z.array(z.string().min(1)),
});
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
export function parseClarification(yamlText) {
    return clarificationSchema.parse(parseYaml(yamlText));
}
/** Normalized hash of the steps shown to the user — not of the prose summary. */
export function stepsContentHash(steps) {
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
export function stepsContentHashFromYaml(clarificationYamlText) {
    const parsed = clarificationSchema.shape.steps.parse(parseYaml(clarificationYamlText).steps);
    return stepsContentHash(parsed);
}
/** Guards one interpretation_check entry against being edited after the fact. */
export function computeEntryHash(entry) {
    return sha256Hex(canonicalJson(entry));
}
/**
 * The only authority on whether a Clarification is done. Never trusts the
 * file's own `status` field — recomputes from `steps` and
 * `interpretation_check` every call, the same way config.yaml's `stages`
 * are progress notes rather than verdicts (Constitution 9).
 */
export function judgeCompletion(clarification, prompt) {
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
    if (issue)
        return issue;
    if (!isMeaningfulText(latest.presented_statement) || !isMeaningfulText(latest.user_statement)) {
        return { confirmed: false, reason: 'incomplete_steps', detail: 'Interpretation and user statement must not be placeholders.' };
    }
    if (!prompt)
        return { confirmed: false, reason: 'missing_prompt' };
    if (prompt.id !== clarification.prompt_ref || latest.prompt_ref !== clarification.prompt_ref)
        return { confirmed: false, reason: 'invalid_prompt_reference' };
    const promptIssue = promptIntegrityIssue(prompt);
    if (promptIssue)
        return { confirmed: false, reason: 'prompt_integrity_violation', detail: promptIssue };
    if (clarification.prompt_content_hash !== prompt.content_hash || latest.prompt_content_hash !== prompt.content_hash)
        return { confirmed: false, reason: 'prompt_changed_since_clarification', detail: 'Missing or stale Prompt snapshot; review against the current original and obtain a new confirmation.' };
    const spanIds = new Set(prompt.spans.map(s => s.id));
    if (clarification.steps.decomposition.some(d => d.span_refs.some(ref => !spanIds.has(ref))) || clarification.finding_candidates.some(f => f.span_refs.some(ref => !spanIds.has(ref))) || (clarification.steps.span_coverage ?? []).some(c => !spanIds.has(c.span_ref)))
        return { confirmed: false, reason: 'invalid_step_reference', detail: 'A source span reference does not resolve in the current Prompt.' };
    const uncovered = uncoveredSpans(clarification, prompt);
    if (uncovered.length)
        return { confirmed: false, reason: 'uncovered_spans', detail: `Prompt spans not decomposed, not raised as a finding candidate, and not dispositioned as non_requirement: ${uncovered.join(', ')}` };
    const merge = mergeReasonIssue(clarification, prompt);
    if (merge)
        return { confirmed: false, reason: 'missing_merge_reason', detail: merge };
    const reading = readingCoverageIssue(clarification, prompt);
    if (reading)
        return { confirmed: false, reason: 'reading_incomplete', detail: reading };
    const forbidden = forbiddenTextIssue(canonicalJson({ steps: clarification.steps, finding_candidates: clarification.finding_candidates }));
    if (forbidden)
        return { confirmed: false, reason: 'incomplete_steps', detail: `Clarification text ${forbidden}.` };
    if (squash(latest.presented_statement) !== squash(renderPresentation(clarification, prompt)))
        return { confirmed: false, reason: 'presented_statement_not_rendered', detail: 'presented_statement must be exactly the text `productkit clarify` renders from the current steps (run it and copy the block verbatim).' };
    return { confirmed: true };
}
const squash = (text) => text.replace(/\s+/g, ' ').trim();
const spanTextById = (prompt, id) => { const span = prompt.spans.find(s => s.id === id); return span ? spanText(prompt.raw_text, span) : '(span not found)'; };
/**
 * The text the user is asked to agree to is rendered by the CLI, not written
 * by the agent. It pairs every decomposed span with its reading, lists every
 * span set aside with its reason, and lists every finding candidate with its
 * spans. The agent can choose the readings and reasons; it cannot choose what
 * the user sees or hide a span behind a summary. `judgeCompletion` requires
 * `presented_statement` to equal this render exactly.
 */
export function renderPresentation(clarification, prompt) {
    const { steps } = clarification;
    const lines = [];
    const defs = steps.definition;
    lines.push(defs.length ? `용어 (${defs.length}):` : '용어: 없음');
    for (const d of defs)
        lines.push(`  - ${squash(d.term)}: ${squash(d.meaning)} (${d.origin === 'user_stated' ? '사용자가 말함' : 'AI 추론'})`);
    // Everything else in the order of the user's own text, so a heading set
    // aside is seen right above the sentences it governs, and a merged reading
    // is seen at every sentence it covers.
    lines.push(`원문 순서 (${prompt.spans.length} 문장):`);
    const aside = steps.span_coverage ?? [];
    const candidates = clarification.finding_candidates;
    for (const span of prompt.spans) {
        lines.push(`${span.id} "${spanText(prompt.raw_text, span)}"`);
        steps.decomposition.forEach((item, i) => {
            if (!item.span_refs.includes(span.id))
                return;
            const first = item.span_refs[0] === span.id;
            if (!first) {
                lines.push(`  → 해석 [${i + 1}] 과 함께 읽음 (${item.span_refs.join(', ')})`);
                return;
            }
            const tags = [];
            if (item.span_refs.length > 1)
                tags.push(`묶음 ${item.span_refs.join(', ')} — ${squash(item.merge_reason ?? '')}`);
            if (item.single_statement_reason)
                tags.push(`한 문장으로 읽음 — ${squash(item.single_statement_reason)}`);
            lines.push(`  → 해석 [${i + 1}]${tags.length ? ` (${tags.join('; ')})` : ''}: ${squash(item.statement)}`);
        });
        for (const c of aside)
            if (c.span_ref === span.id)
                lines.push(`  → 요구사항 아님: ${squash(c.reason)}`);
        candidates.forEach((f, i) => { if (f.span_refs.includes(span.id))
            lines.push(`  → 질문 [Q${i + 1}] ${f.type}: ${squash(f.statement)}${f.span_refs.length > 1 ? ` (${f.span_refs.join(', ')})` : ''}`); });
    }
    lines.push(`요구사항 아님: ${aside.length} 문장 / 질문으로 남김: ${candidates.length} 건`);
    const rel = steps.relation_check;
    lines.push(rel.length ? `관계 후보 (${rel.length}):` : `관계 후보: 없음 — ${squash(steps.relation_check_no_items_reason ?? '')}`);
    for (const r of rel)
        lines.push(`  - ${squash(r.statement_a)} ↔ ${squash(r.statement_b)}: ${squash(r.relation_candidate)}`);
    const cx = steps.counterexample;
    lines.push(cx.length ? `달리 읽힐 수 있는 곳 (${cx.length}):` : `달리 읽힐 수 있는 곳: 없음 — ${squash(steps.counterexample_no_items_reason ?? '')}`);
    for (const x of cx)
        lines.push(`  - ${squash(x.ambiguity)}: ${x.possible_interpretations.map(squash).join(' / ')}`);
    return lines.join('\n');
}
/** A span carrying this many clause separators, read as one statement, needs a stated reason. */
export const CLAUSE_SIGNAL_THRESHOLD = 3;
/**
 * Where requirements get merged away: one item citing several spans, or one
 * item being the only reading of a span that plainly carries several
 * clauses. Neither is forbidden; both need a reason the user will see.
 */
/** A reason must say something: not a placeholder, not "x". */
export const isReason = (value) => isMeaningfulText(value) && value.trim().length >= 6 && contentTokens(value).size >= 2;
export function mergeReasonIssue(clarification, prompt) {
    const items = clarification.steps.decomposition;
    for (const [i, item] of items.entries()) {
        if (item.span_refs.length > 1 && !isReason(item.merge_reason))
            return `decomposition[${i}] cites ${item.span_refs.length} spans (${item.span_refs.join(', ')}) but gives no merge_reason (6+ characters, 2+ words).`;
    }
    for (const [i, c] of (clarification.steps.span_coverage ?? []).entries()) {
        if (!isReason(c.reason))
            return `span_coverage[${i}] (${c.span_ref}) needs a reason of 6+ characters and 2+ words.`;
        const text = spanTextById(prompt, c.span_ref);
        if (/[?？]\s*$/.test(text))
            return `span_coverage[${i}] sets aside ${c.span_ref}, which is a question; decompose it or raise it as a finding candidate.`;
        // A sentence carrying a number, a negation/condition word, or simply a
        // lot of content is saying something a product must do; it cannot be
        // filed as "not a requirement".
        if (!isStructuralSpan(text) && (numberTokens(text).length || polarityTokens(text).length))
            return `span_coverage[${i}] sets aside ${c.span_ref}, which carries ${numberTokens(text).length ? 'a number' : 'a negation/condition word'} (${[...numberTokens(text), ...polarityTokens(text)].slice(0, 4).join(', ')}); decompose it or raise it as a finding candidate.`;
        if (!isStructuralSpan(text) && contentTokenList(text).length >= 10)
            return `span_coverage[${i}] sets aside ${c.span_ref}, which has ${contentTokenList(text).length} content words; a sentence that long is not a heading or an aside — decompose it or raise it as a finding candidate.`;
    }
    return undefined;
}
/** Does `readings` restate `source`: every number of source present, 60%+ of its content words, and no number invented? */
export function restatementIssue(source, readings) {
    const union = readings.join(' ');
    const unionText = union.replace(/\s+/g, '');
    const missingNumbers = numberTokens(source).filter(n => !unionText.includes(n.replace(/\s+/g, '')));
    if (missingNumbers.length)
        return `drops these numbers: ${missingNumbers.join(', ')}`;
    const sourceText = source.replace(/\s+/g, '');
    const invented = readings.flatMap(r => numberTokens(r)).filter(n => !sourceText.includes(n.replace(/\s+/g, '')));
    if (invented.length)
        return `adds numbers absent from the source: ${invented.join(', ')}`;
    // Negations, exceptions and bounds flip the requirement; each must survive.
    const missingPolarity = polarityTokens(source).filter(p => !union.includes(p));
    if (missingPolarity.length)
        return `drops these negation/condition words: ${[...new Set(missingPolarity)].join(', ')}`;
    const sourceTokens = contentTokenList(source);
    if (sourceTokens.length >= 3) {
        // Order matters: a bag of the same words in another order is not a restatement.
        const best = Math.max(...readings.map(r => lcsLength(sourceTokens, contentTokenList(r))), 0);
        const unionTokens = contentTokens(union);
        const keptAnywhere = sourceTokens.filter(t => unionTokens.has(t) || unionText.toLowerCase().includes(t));
        const ratio = Math.max(best, readings.length > 1 ? keptAnywhere.length : 0) / sourceTokens.length;
        if (ratio < READING_COVERAGE_RATIO)
            return `carries ${Math.round(ratio * 100)}% of the source's content words in order (need ${READING_COVERAGE_RATIO * 100}%); missing e.g. ${sourceTokens.filter(t => !keptAnywhere.includes(t)).slice(0, 6).join(', ')}`;
    }
    return undefined;
}
/**
 * Each statement must be one contiguous slice of `source`, or two slices
 * joined by a space (a shared trigger carried into a split piece). Together
 * the slices must cover every content word of the source. Nothing can be
 * flipped, dropped or reordered: the only freedom is where to cut.
 */
export function sliceIssue(source, statements) {
    const src = squash(source);
    const covered = new Array(src.length).fill(false);
    const mark = (a, b) => { for (let i = a; i < b; i++)
        covered[i] = true; };
    const locate = (s) => {
        const whole = src.indexOf(s);
        if (whole >= 0)
            return [[whole, whole + s.length]];
        for (let cut = s.indexOf(' '); cut > 0; cut = s.indexOf(' ', cut + 1)) {
            const a = s.slice(0, cut);
            const b = s.slice(cut + 1);
            const ia = src.indexOf(a);
            const ib = src.indexOf(b);
            if (ia >= 0 && ib >= 0)
                return [[ia, ia + a.length], [ib, ib + b.length]];
        }
        return undefined;
    };
    for (const st of statements) {
        const s = squash(st).replace(/[.。]$/, '');
        if (!s)
            return 'an empty statement';
        const parts = locate(s);
        if (!parts)
            return `"${s.slice(0, 50)}${s.length > 50 ? '…' : ''}" is not a verbatim slice (or two slices) of "${src.slice(0, 50)}${src.length > 50 ? '…' : ''}"`;
        for (const [a, b] of parts)
            mark(a, b);
    }
    const missing = [];
    const re = /[^\s,.;:!?()\[\]{}"'`“”‘’·/|]+/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        const token = m[0];
        if (token.length < 2 && !/^[한두세네열백천]$/.test(token))
            continue;
        let ok = true;
        for (let i = m.index; i < m.index + token.length; i++)
            if (!covered[i]) {
                ok = false;
                break;
            }
        if (!ok)
            missing.push(token);
    }
    if (missing.length)
        return `these source words are in no slice: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', …' : ''}`;
    return undefined;
}
/** Share of a span's content that its readings must carry. */
export const READING_COVERAGE_RATIO = 0.6;
/**
 * A reading must restate the sentence, not label it. Every number in the
 * span must appear in the union of statements that cite it, and most of its
 * content words must too. "운동 앱의 요구사항" for a six-requirement line fails
 * here; a near-verbatim reading passes, and the split happens at atomize.
 */
export function readingCoverageIssue(clarification, prompt) {
    // A reading is the user's sentence, verbatim. There is nothing to
    // paraphrase at this stage: the user decides which sentences are
    // requirements, which are set aside, which are questions. Splitting into
    // atomic pieces happens at atomize, as verbatim slices of these sentences.
    for (const [i, item] of clarification.steps.decomposition.entries()) {
        const expected = squash(item.span_refs.map(id => spanTextById(prompt, id)).join(' '));
        if (squash(item.statement) !== expected)
            return `decomposition[${i}] must be the span text verbatim: expected "${expected.slice(0, 60)}${expected.length > 60 ? '…' : ''}"`;
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
export function uncoveredSpans(clarification, prompt) {
    const covered = new Set();
    for (const d of clarification.steps.decomposition)
        for (const ref of d.span_refs)
            covered.add(ref);
    for (const f of clarification.finding_candidates)
        for (const ref of f.span_refs)
            covered.add(ref);
    for (const c of clarification.steps.span_coverage ?? [])
        if (isMeaningfulText(c.reason))
            covered.add(c.span_ref);
    return prompt.spans.map(s => s.id).filter(id => !covered.has(id));
}
/**
 * What is wrong with the steps themselves, before any confirmation is
 * considered: structure, span coverage, merge reasons. `productkit clarify`
 * reports this first so the agent fixes steps before asking the user.
 */
export function stepsReadinessIssue(clarification, prompt) {
    const forbidden = forbiddenTextIssue(canonicalJson({ steps: clarification.steps, finding_candidates: clarification.finding_candidates }));
    if (forbidden)
        return { confirmed: false, reason: 'incomplete_steps', detail: `Clarification text ${forbidden}.` };
    const issue = clarificationStepsIssue(clarification.steps);
    if (issue)
        return issue;
    const uncovered = uncoveredSpans(clarification, prompt);
    if (uncovered.length)
        return { confirmed: false, reason: 'uncovered_spans', detail: `Prompt spans not decomposed, not raised as a finding candidate, and not dispositioned as non_requirement: ${uncovered.join(', ')}` };
    const merge = mergeReasonIssue(clarification, prompt);
    if (merge)
        return { confirmed: false, reason: 'missing_merge_reason', detail: merge };
    const reading = readingCoverageIssue(clarification, prompt);
    if (reading)
        return { confirmed: false, reason: 'reading_incomplete', detail: reading };
    return undefined;
}
/** Completion requirements are stricter than parsing an editable, unfinished draft. */
export function clarificationStepsIssue(steps) {
    const incomplete = (detail) => ({ confirmed: false, reason: 'incomplete_steps', detail });
    if (!clarificationStepsSchema.safeParse(steps).success)
        return incomplete('Invalid step structure.');
    if (!steps.definition.length || steps.definition.some(d => !isMeaningfulText(d.term) || !isMeaningfulText(d.meaning)))
        return incomplete('Definition requires substantive term/meaning records.');
    if (!steps.decomposition.length || steps.decomposition.some(d => !isMeaningfulText(d.statement) || !d.span_refs.length || d.span_refs.some(r => !isMeaningfulText(r))))
        return incomplete('Decomposition requires statements with source span references.');
    if (!steps.elaboration.length || steps.elaboration.some(e => [e.statement, e.actor, e.object, e.condition, e.action, e.result].some(v => !isMeaningfulText(v))))
        return incomplete('Elaboration requires statement, actor, object, condition, action and result.');
    const statements = new Set(steps.decomposition.map(d => d.statement));
    if (steps.elaboration.some(e => !statements.has(e.statement)) || steps.decomposition.some(d => !steps.elaboration.some(e => e.statement === d.statement)))
        return { confirmed: false, reason: 'invalid_step_reference', detail: 'Elaboration must reference and cover decomposition statements exactly.' };
    for (const relation of steps.relation_check) {
        if (![relation.statement_a, relation.statement_b, relation.relation_candidate].every(isMeaningfulText))
            return incomplete('Relation review contains a placeholder.');
        if (!statements.has(relation.statement_a) || !statements.has(relation.statement_b) || relation.statement_a === relation.statement_b)
            return { confirmed: false, reason: 'invalid_step_reference', detail: 'Relation review must reference two distinct decomposition statements.' };
    }
    if (!steps.relation_check.length && !isMeaningfulText(steps.relation_check_no_items_reason))
        return incomplete('Relation review requires candidates or an explicit reviewed-no-items reason.');
    if (steps.relation_check.length && isMeaningfulText(steps.relation_check_no_items_reason))
        return incomplete('Relation review cannot have candidates and a no-items assertion together.');
    if (steps.counterexample.some(c => !isMeaningfulText(c.ambiguity) || c.possible_interpretations.length < 2 || c.possible_interpretations.some(v => !isMeaningfulText(v))))
        return incomplete('Counterexample requires an ambiguity and at least two substantive interpretations.');
    if (!steps.counterexample.length && !isMeaningfulText(steps.counterexample_no_items_reason))
        return incomplete('Counterexample review requires records or an explicit reviewed-no-items reason.');
    if (steps.counterexample.length && isMeaningfulText(steps.counterexample_no_items_reason))
        return incomplete('Counterexample review cannot have records and a no-items assertion together.');
    return undefined;
}
/** NodeGroup binds to source identity, Prompt version and confirmation history, not only steps. */
export function clarificationContentHash(clarification) {
    const { status: _status, ...content } = clarification;
    return sha256Hex(canonicalJson(content));
}
//# sourceMappingURL=clarification.js.map