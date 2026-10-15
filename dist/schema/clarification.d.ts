import { z } from 'zod';
import { type Prompt } from './prompt.js';
/**
 * The six Clarification steps. `origin` on a definition item separates what
 * the user actually said from what the AI inferred — neither CLI nor spec
 * can verify that a `user_stated` entry is truthful; it only records which
 * bucket the author put it in (Constitution 2, 4).
 */
export declare const definitionItemSchema: z.ZodObject<{
    term: z.ZodString;
    meaning: z.ZodString;
    origin: z.ZodEnum<{
        ai_inferred: "ai_inferred";
        user_stated: "user_stated";
    }>;
}, z.core.$strip>;
export declare const decompositionItemSchema: z.ZodObject<{
    statement: z.ZodString;
    span_refs: z.ZodArray<z.ZodString>;
    merge_reason: z.ZodOptional<z.ZodString>;
    single_statement_reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const elaborationItemSchema: z.ZodObject<{
    statement: z.ZodString;
    actor: z.ZodOptional<z.ZodString>;
    object: z.ZodOptional<z.ZodString>;
    condition: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodString>;
    result: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * A candidate relation, not a Graph edge. Change 04 owns typed, validated
 * edges; this change only records "these two statements look related".
 */
export declare const relationCheckItemSchema: z.ZodObject<{
    statement_a: z.ZodString;
    statement_b: z.ZodString;
    relation_candidate: z.ZodString;
}, z.core.$strip>;
export declare const counterexampleItemSchema: z.ZodObject<{
    ambiguity: z.ZodString;
    possible_interpretations: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
/**
 * A Prompt span that no decomposition item or finding candidate references.
 * The only legal reason is that the span carries no requirement (a heading,
 * an analogy, a worked example, narrative). Listing it here is the author's
 * claim; it sits inside `steps` so the user agrees to it along with the
 * decomposition (Constitution 11).
 */
export declare const spanCoverageItemSchema: z.ZodObject<{
    span_ref: z.ZodString;
    disposition: z.ZodLiteral<"non_requirement">;
    reason: z.ZodString;
}, z.core.$strip>;
export declare const clarificationStepsSchema: z.ZodObject<{
    definition: z.ZodDefault<z.ZodArray<z.ZodObject<{
        term: z.ZodString;
        meaning: z.ZodString;
        origin: z.ZodEnum<{
            ai_inferred: "ai_inferred";
            user_stated: "user_stated";
        }>;
    }, z.core.$strip>>>;
    decomposition: z.ZodDefault<z.ZodArray<z.ZodObject<{
        statement: z.ZodString;
        span_refs: z.ZodArray<z.ZodString>;
        merge_reason: z.ZodOptional<z.ZodString>;
        single_statement_reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    elaboration: z.ZodDefault<z.ZodArray<z.ZodObject<{
        statement: z.ZodString;
        actor: z.ZodOptional<z.ZodString>;
        object: z.ZodOptional<z.ZodString>;
        condition: z.ZodOptional<z.ZodString>;
        action: z.ZodOptional<z.ZodString>;
        result: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    relation_check: z.ZodDefault<z.ZodArray<z.ZodObject<{
        statement_a: z.ZodString;
        statement_b: z.ZodString;
        relation_candidate: z.ZodString;
    }, z.core.$strip>>>;
    counterexample: z.ZodDefault<z.ZodArray<z.ZodObject<{
        ambiguity: z.ZodString;
        possible_interpretations: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>>;
    relation_check_no_items_reason: z.ZodOptional<z.ZodString>;
    counterexample_no_items_reason: z.ZodOptional<z.ZodString>;
    span_coverage: z.ZodOptional<z.ZodArray<z.ZodObject<{
        span_ref: z.ZodString;
        disposition: z.ZodLiteral<"non_requirement">;
        reason: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
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
export declare const interpretationCheckEntrySchema: z.ZodObject<{
    id: z.ZodString;
    presented_statement: z.ZodString;
    presented_hash: z.ZodString;
    prompt_ref: z.ZodOptional<z.ZodString>;
    prompt_content_hash: z.ZodOptional<z.ZodString>;
    user_response: z.ZodEnum<{
        agreed: "agreed";
        disagreed: "disagreed";
        partially_agreed: "partially_agreed";
    }>;
    user_statement: z.ZodString;
    attestation: z.ZodOptional<z.ZodEnum<{
        flag: "flag";
        tty: "tty";
    }>>;
    checked_at: z.ZodString;
    entry_hash: z.ZodString;
}, z.core.$strip>;
export type InterpretationCheckEntry = z.infer<typeof interpretationCheckEntrySchema>;
export declare const findingCandidateSchema: z.ZodObject<{
    statement: z.ZodString;
    type: z.ZodEnum<{
        ambiguity: "ambiguity";
        contradiction: "contradiction";
        missing_premise: "missing_premise";
    }>;
    span_refs: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type FindingCandidate = z.infer<typeof findingCandidateSchema>;
export declare const clarificationStatusSchema: z.ZodEnum<{
    awaiting_confirmation: "awaiting_confirmation";
    confirmed: "confirmed";
    in_progress: "in_progress";
}>;
export declare const clarificationSchema: z.ZodObject<{
    id: z.ZodString;
    prompt_ref: z.ZodString;
    prompt_content_hash: z.ZodOptional<z.ZodString>;
    steps: z.ZodObject<{
        definition: z.ZodDefault<z.ZodArray<z.ZodObject<{
            term: z.ZodString;
            meaning: z.ZodString;
            origin: z.ZodEnum<{
                ai_inferred: "ai_inferred";
                user_stated: "user_stated";
            }>;
        }, z.core.$strip>>>;
        decomposition: z.ZodDefault<z.ZodArray<z.ZodObject<{
            statement: z.ZodString;
            span_refs: z.ZodArray<z.ZodString>;
            merge_reason: z.ZodOptional<z.ZodString>;
            single_statement_reason: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        elaboration: z.ZodDefault<z.ZodArray<z.ZodObject<{
            statement: z.ZodString;
            actor: z.ZodOptional<z.ZodString>;
            object: z.ZodOptional<z.ZodString>;
            condition: z.ZodOptional<z.ZodString>;
            action: z.ZodOptional<z.ZodString>;
            result: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        relation_check: z.ZodDefault<z.ZodArray<z.ZodObject<{
            statement_a: z.ZodString;
            statement_b: z.ZodString;
            relation_candidate: z.ZodString;
        }, z.core.$strip>>>;
        counterexample: z.ZodDefault<z.ZodArray<z.ZodObject<{
            ambiguity: z.ZodString;
            possible_interpretations: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>>;
        relation_check_no_items_reason: z.ZodOptional<z.ZodString>;
        counterexample_no_items_reason: z.ZodOptional<z.ZodString>;
        span_coverage: z.ZodOptional<z.ZodArray<z.ZodObject<{
            span_ref: z.ZodString;
            disposition: z.ZodLiteral<"non_requirement">;
            reason: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
    status: z.ZodEnum<{
        awaiting_confirmation: "awaiting_confirmation";
        confirmed: "confirmed";
        in_progress: "in_progress";
    }>;
    interpretation_check: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        presented_statement: z.ZodString;
        presented_hash: z.ZodString;
        prompt_ref: z.ZodOptional<z.ZodString>;
        prompt_content_hash: z.ZodOptional<z.ZodString>;
        user_response: z.ZodEnum<{
            agreed: "agreed";
            disagreed: "disagreed";
            partially_agreed: "partially_agreed";
        }>;
        user_statement: z.ZodString;
        attestation: z.ZodOptional<z.ZodEnum<{
            flag: "flag";
            tty: "tty";
        }>>;
        checked_at: z.ZodString;
        entry_hash: z.ZodString;
    }, z.core.$strip>>>;
    finding_candidates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        statement: z.ZodString;
        type: z.ZodEnum<{
            ambiguity: "ambiguity";
            contradiction: "contradiction";
            missing_premise: "missing_premise";
        }>;
        span_refs: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type Clarification = z.infer<typeof clarificationSchema>;
export declare function parseClarification(yamlText: string): Clarification;
/** Normalized hash of the steps shown to the user — not of the prose summary. */
export declare function stepsContentHash(steps: ClarificationSteps): string;
/**
 * Same as `stepsContentHash`, but takes the Clarification artifact's raw
 * YAML text directly. This exists so an Agent writing the artifact never
 * needs its own dependency on the `yaml` package — a consuming app's
 * node_modules layout does not guarantee `yaml` is resolvable from its own
 * root (it may be nested under productkit's own node_modules rather than
 * hoisted). Parsing happens inside productkit, where `yaml` is always
 * resolvable regardless of the consumer's dependency tree.
 */
export declare function stepsContentHashFromYaml(clarificationYamlText: string): string;
/** Guards one interpretation_check entry against being edited after the fact. */
export declare function computeEntryHash(entry: Omit<InterpretationCheckEntry, 'entry_hash'>): string;
export type CompletionBlockReason = 'no_confirmation' | 'not_agreed' | 'missing_user_statement' | 'content_changed_since_confirmation' | 'integrity_violation' | 'incomplete_steps' | 'invalid_step_reference' | 'missing_prompt' | 'invalid_prompt_reference' | 'prompt_integrity_violation' | 'prompt_changed_since_clarification' | 'uncovered_spans' | 'missing_merge_reason' | 'reading_incomplete' | 'presented_statement_not_rendered';
export type CompletionJudgement = {
    confirmed: true;
} | {
    confirmed: false;
    reason: CompletionBlockReason;
    detail?: string;
};
/**
 * The only authority on whether a Clarification is done. Never trusts the
 * file's own `status` field — recomputes from `steps` and
 * `interpretation_check` every call, the same way config.yaml's `stages`
 * are progress notes rather than verdicts (Constitution 9).
 */
export declare function judgeCompletion(clarification: Clarification, prompt?: Prompt): CompletionJudgement;
/**
 * The text the user is asked to agree to is rendered by the CLI, not written
 * by the agent. It pairs every decomposed span with its reading, lists every
 * span set aside with its reason, and lists every finding candidate with its
 * spans. The agent can choose the readings and reasons; it cannot choose what
 * the user sees or hide a span behind a summary. `judgeCompletion` requires
 * `presented_statement` to equal this render exactly.
 */
export declare function renderPresentation(clarification: Pick<Clarification, 'steps' | 'finding_candidates'>, prompt: Prompt): string;
/**
 * Where requirements get merged away: one item citing several spans, or one
 * item being the only reading of a span that plainly carries several
 * clauses. Neither is forbidden; both need a reason the user will see.
 */
/** A reason must say something: not a placeholder, not "x". */
export declare const isReason: (value: unknown) => value is string;
export declare function mergeReasonIssue(clarification: Pick<Clarification, 'steps' | 'finding_candidates'>, prompt: Prompt): string | undefined;
/**
 * A Node is a decomposition item's text — the user's sentence(s), verbatim —
 * and there is exactly one per item. Slicing a sentence into pieces was
 * gamed seven ways (trigger pairing, condition forms, connective cuts,
 * one-character drops); the only split that loses nothing is the one the
 * user makes by restating the idea in separate sentences (a new intake).
 */
export declare function sliceIssue(source: string, statements: string[], _segments?: string[]): string | undefined;
/**
 * A reading must restate the sentence, not label it. Every number in the
 * span must appear in the union of statements that cite it, and most of its
 * content words must too. "운동 앱의 요구사항" for a six-requirement line fails
 * here; a near-verbatim reading passes, and the split happens at atomize.
 */
export declare function readingCoverageIssue(clarification: Pick<Clarification, 'steps'>, prompt: Prompt): string | undefined;
/**
 * Every span of the Prompt must land somewhere: in a decomposition statement
 * or in a finding candidate (Constitution 11). This is the reverse direction
 * of span_refs: span_refs prove that what was decomposed came from the
 * Prompt; this proves that nothing in the Prompt was silently skipped. Only
 * wordless structure lines are set aside, by the CLI, and the export lists them.
 */
export declare function uncoveredSpans(clarification: Clarification, prompt: Prompt): string[];
/**
 * What is wrong with the steps themselves, before any confirmation is
 * considered: structure, span coverage, merge reasons. `productkit clarify`
 * reports this first so the agent fixes steps before asking the user.
 */
export declare function stepsReadinessIssue(clarification: Clarification, prompt: Prompt): Extract<CompletionJudgement, {
    confirmed: false;
}> | undefined;
/** Completion requirements are stricter than parsing an editable, unfinished draft. */
export declare function clarificationStepsIssue(steps: ClarificationSteps): Extract<CompletionJudgement, {
    confirmed: false;
}> | undefined;
/** NodeGroup binds to source identity, Prompt version and confirmation history, not only steps. */
export declare function clarificationContentHash(clarification: Clarification): string;
