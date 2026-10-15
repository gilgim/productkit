import { type Clarification, type ClarificationSteps } from './clarification.js';
import type { Prompt } from './prompt.js';
import { z } from 'zod';
export declare const nodeKindSchema: z.ZodEnum<{
    fact: "fact";
    inference: "inference";
    policy: "policy";
    requirement: "requirement";
}>;
/**
 * Which decomposition item (by index into Clarification.steps.decomposition)
 * a Node was derived from. Decomposition items have no id of their own
 * (Change 02 did not add one); the index is safe to use here because any
 * reorder of `decomposition` changes `steps`, which changes
 * `source_content_hash`, which forces re-modeling anyway (see the
 * invalidation requirement).
 */
export declare const nodeDerivedFromSchema: z.ZodObject<{
    clarification_ref: z.ZodString;
    decomposition_index: z.ZodNumber;
}, z.core.$strip>;
/**
 * Atomicity is three separate judgements, never one. `single_verifiable_subject`
 * decides whether a split is even in question; `decomposability` decides
 * whether a candidate split would orphan a piece; `meaning_preservation`
 * decides whether the chosen outcome (split or not) still says what the
 * source decomposition item said. All three are AI judgements with a reason;
 * `final` is the one thing the CLI derives deterministically from the other
 * three (see `evaluateAtomicity`) — it never re-judges the AI's verdicts.
 */
export declare const singleVerifiableSubjectSchema: z.ZodObject<{
    verdict: z.ZodEnum<{
        no: "no";
        uncertain: "uncertain";
        yes: "yes";
    }>;
    reason: z.ZodString;
}, z.core.$strip>;
export declare const decomposabilitySchema: z.ZodObject<{
    verdict: z.ZodEnum<{
        not_applicable: "not_applicable";
        valid_split: "valid_split";
        would_orphan_pieces: "would_orphan_pieces";
    }>;
    reason: z.ZodString;
}, z.core.$strip>;
export declare const meaningPreservationSchema: z.ZodObject<{
    verdict: z.ZodEnum<{
        distorted: "distorted";
        preserved: "preserved";
        uncertain: "uncertain";
    }>;
    confidence: z.ZodEnum<{
        high: "high";
        low: "low";
        medium: "medium";
    }>;
    reason: z.ZodString;
}, z.core.$strip>;
export declare const atomicityFinalSchema: z.ZodEnum<{
    atomic: "atomic";
    split_required: "split_required";
}>;
export declare const atomicitySchema: z.ZodObject<{
    single_verifiable_subject: z.ZodObject<{
        verdict: z.ZodEnum<{
            no: "no";
            uncertain: "uncertain";
            yes: "yes";
        }>;
        reason: z.ZodString;
    }, z.core.$strip>;
    decomposability: z.ZodObject<{
        verdict: z.ZodEnum<{
            not_applicable: "not_applicable";
            valid_split: "valid_split";
            would_orphan_pieces: "would_orphan_pieces";
        }>;
        reason: z.ZodString;
    }, z.core.$strip>;
    meaning_preservation: z.ZodObject<{
        verdict: z.ZodEnum<{
            distorted: "distorted";
            preserved: "preserved";
            uncertain: "uncertain";
        }>;
        confidence: z.ZodEnum<{
            high: "high";
            low: "low";
            medium: "medium";
        }>;
        reason: z.ZodString;
    }, z.core.$strip>;
    final: z.ZodNullable<z.ZodEnum<{
        atomic: "atomic";
        split_required: "split_required";
    }>>;
}, z.core.$strip>;
export type Atomicity = z.infer<typeof atomicitySchema>;
/**
 * Deterministically combines the three sub-verdicts into `final`. This is a
 * fixed truth table over values the AI already supplied — it does not
 * evaluate whether those values are *correct*, only what they imply
 * together (Change 03 approval condition 2: CLI never proves the AI's
 * atomicity judgement itself).
 */
export declare function evaluateAtomicityFinal(input: Omit<Atomicity, 'final'>): Atomicity['final'];
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
export declare function computeStructuralSignal(statement: string): StructuralSignal;
/**
 * Weak, decidable "addition suspected" signal: how much of the Node's own
 * vocabulary (space-separated tokens, 2+ chars) also appears in the source
 * decomposition statement. Low overlap is a candidate to review, never a
 * confirmed error (spec.md: "약한 신호일 뿐 확정 판정이 아니다").
 */
export declare function computeLexicalOverlapRatio(nodeStatement: string, sourceStatement: string): number;
/** Below this ratio, flag "addition suspected" as a candidate (not a verdict). */
export declare const ADDITION_SUSPECT_THRESHOLD = 0.5;
export declare const nodeSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        fact: "fact";
        inference: "inference";
        policy: "policy";
        requirement: "requirement";
    }>;
    statement: z.ZodString;
    split_from: z.ZodOptional<z.ZodString>;
    origin: z.ZodEnum<{
        inference: "inference";
        source: "source";
    }>;
    derived_from: z.ZodObject<{
        clarification_ref: z.ZodString;
        decomposition_index: z.ZodNumber;
    }, z.core.$strip>;
    structural_signal: z.ZodObject<{
        conjunction_count: z.ZodNumber;
        multiple_predicates: z.ZodBoolean;
    }, z.core.$strip>;
    atomicity: z.ZodObject<{
        single_verifiable_subject: z.ZodObject<{
            verdict: z.ZodEnum<{
                no: "no";
                uncertain: "uncertain";
                yes: "yes";
            }>;
            reason: z.ZodString;
        }, z.core.$strip>;
        decomposability: z.ZodObject<{
            verdict: z.ZodEnum<{
                not_applicable: "not_applicable";
                valid_split: "valid_split";
                would_orphan_pieces: "would_orphan_pieces";
            }>;
            reason: z.ZodString;
        }, z.core.$strip>;
        meaning_preservation: z.ZodObject<{
            verdict: z.ZodEnum<{
                distorted: "distorted";
                preserved: "preserved";
                uncertain: "uncertain";
            }>;
            confidence: z.ZodEnum<{
                high: "high";
                low: "low";
                medium: "medium";
            }>;
            reason: z.ZodString;
        }, z.core.$strip>;
        final: z.ZodNullable<z.ZodEnum<{
            atomic: "atomic";
            split_required: "split_required";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type Node = z.infer<typeof nodeSchema>;
export declare const nodeFindingCandidateSchema: z.ZodObject<{
    id: z.ZodString;
    node_ref: z.ZodString;
    type: z.ZodEnum<{
        addition: "addition";
        condition_change: "condition_change";
        distortion: "distortion";
        operator_change: "operator_change";
    }>;
    statement: z.ZodString;
    status: z.ZodEnum<{
        deferred: "deferred";
        dismissed: "dismissed";
        open: "open";
        resolved: "resolved";
    }>;
    resolution_ref: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type NodeFindingCandidate = z.infer<typeof nodeFindingCandidateSchema>;
/** Only these four types gate `modeled` — a plain ambiguity does not. */
export declare const BLOCKING_FINDING_TYPES: ReadonlySet<NodeFindingCandidate['type']>;
export declare const distortionCheckSchema: z.ZodObject<{
    decomposition_index: z.ZodNumber;
    reconstructed_statement: z.ZodString;
    condition_preservation: z.ZodOptional<z.ZodObject<{
        verdict: z.ZodEnum<{
            distorted: "distorted";
            not_applicable: "not_applicable";
            preserved: "preserved";
            uncertain: "uncertain";
        }>;
        reason: z.ZodString;
    }, z.core.$strip>>;
    operator_preservation: z.ZodOptional<z.ZodObject<{
        verdict: z.ZodEnum<{
            distorted: "distorted";
            not_applicable: "not_applicable";
            preserved: "preserved";
            uncertain: "uncertain";
        }>;
        reason: z.ZodString;
    }, z.core.$strip>>;
    exception_preservation: z.ZodOptional<z.ZodObject<{
        verdict: z.ZodEnum<{
            distorted: "distorted";
            not_applicable: "not_applicable";
            preserved: "preserved";
            uncertain: "uncertain";
        }>;
        reason: z.ZodString;
    }, z.core.$strip>>;
    verdict: z.ZodEnum<{
        distorted: "distorted";
        preserved: "preserved";
        uncertain: "uncertain";
    }>;
    confidence: z.ZodEnum<{
        high: "high";
        low: "low";
        medium: "medium";
    }>;
    reason: z.ZodString;
}, z.core.$strip>;
export type DistortionCheck = z.infer<typeof distortionCheckSchema>;
export declare const nodeGroupStatusSchema: z.ZodEnum<{
    in_progress: "in_progress";
    modeled: "modeled";
    needs_review: "needs_review";
}>;
export declare const coverageSchema: z.ZodObject<{
    complete: z.ZodBoolean;
    uncovered_decomposition_indices: z.ZodArray<z.ZodNumber>;
}, z.core.$strip>;
export declare const nodeGroupSchema: z.ZodObject<{
    id: z.ZodString;
    clarification_ref: z.ZodString;
    source_content_hash: z.ZodString;
    clarification_content_hash: z.ZodOptional<z.ZodString>;
    nodes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            fact: "fact";
            inference: "inference";
            policy: "policy";
            requirement: "requirement";
        }>;
        statement: z.ZodString;
        split_from: z.ZodOptional<z.ZodString>;
        origin: z.ZodEnum<{
            inference: "inference";
            source: "source";
        }>;
        derived_from: z.ZodObject<{
            clarification_ref: z.ZodString;
            decomposition_index: z.ZodNumber;
        }, z.core.$strip>;
        structural_signal: z.ZodObject<{
            conjunction_count: z.ZodNumber;
            multiple_predicates: z.ZodBoolean;
        }, z.core.$strip>;
        atomicity: z.ZodObject<{
            single_verifiable_subject: z.ZodObject<{
                verdict: z.ZodEnum<{
                    no: "no";
                    uncertain: "uncertain";
                    yes: "yes";
                }>;
                reason: z.ZodString;
            }, z.core.$strip>;
            decomposability: z.ZodObject<{
                verdict: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    valid_split: "valid_split";
                    would_orphan_pieces: "would_orphan_pieces";
                }>;
                reason: z.ZodString;
            }, z.core.$strip>;
            meaning_preservation: z.ZodObject<{
                verdict: z.ZodEnum<{
                    distorted: "distorted";
                    preserved: "preserved";
                    uncertain: "uncertain";
                }>;
                confidence: z.ZodEnum<{
                    high: "high";
                    low: "low";
                    medium: "medium";
                }>;
                reason: z.ZodString;
            }, z.core.$strip>;
            final: z.ZodNullable<z.ZodEnum<{
                atomic: "atomic";
                split_required: "split_required";
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
    retired_nodes: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            fact: "fact";
            inference: "inference";
            policy: "policy";
            requirement: "requirement";
        }>;
        statement: z.ZodString;
        split_from: z.ZodOptional<z.ZodString>;
        origin: z.ZodEnum<{
            inference: "inference";
            source: "source";
        }>;
        derived_from: z.ZodObject<{
            clarification_ref: z.ZodString;
            decomposition_index: z.ZodNumber;
        }, z.core.$strip>;
        structural_signal: z.ZodObject<{
            conjunction_count: z.ZodNumber;
            multiple_predicates: z.ZodBoolean;
        }, z.core.$strip>;
        atomicity: z.ZodObject<{
            single_verifiable_subject: z.ZodObject<{
                verdict: z.ZodEnum<{
                    no: "no";
                    uncertain: "uncertain";
                    yes: "yes";
                }>;
                reason: z.ZodString;
            }, z.core.$strip>;
            decomposability: z.ZodObject<{
                verdict: z.ZodEnum<{
                    not_applicable: "not_applicable";
                    valid_split: "valid_split";
                    would_orphan_pieces: "would_orphan_pieces";
                }>;
                reason: z.ZodString;
            }, z.core.$strip>;
            meaning_preservation: z.ZodObject<{
                verdict: z.ZodEnum<{
                    distorted: "distorted";
                    preserved: "preserved";
                    uncertain: "uncertain";
                }>;
                confidence: z.ZodEnum<{
                    high: "high";
                    low: "low";
                    medium: "medium";
                }>;
                reason: z.ZodString;
            }, z.core.$strip>;
            final: z.ZodNullable<z.ZodEnum<{
                atomic: "atomic";
                split_required: "split_required";
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
    coverage: z.ZodObject<{
        complete: z.ZodBoolean;
        uncovered_decomposition_indices: z.ZodArray<z.ZodNumber>;
    }, z.core.$strip>;
    distortion_checks: z.ZodDefault<z.ZodArray<z.ZodObject<{
        decomposition_index: z.ZodNumber;
        reconstructed_statement: z.ZodString;
        condition_preservation: z.ZodOptional<z.ZodObject<{
            verdict: z.ZodEnum<{
                distorted: "distorted";
                not_applicable: "not_applicable";
                preserved: "preserved";
                uncertain: "uncertain";
            }>;
            reason: z.ZodString;
        }, z.core.$strip>>;
        operator_preservation: z.ZodOptional<z.ZodObject<{
            verdict: z.ZodEnum<{
                distorted: "distorted";
                not_applicable: "not_applicable";
                preserved: "preserved";
                uncertain: "uncertain";
            }>;
            reason: z.ZodString;
        }, z.core.$strip>>;
        exception_preservation: z.ZodOptional<z.ZodObject<{
            verdict: z.ZodEnum<{
                distorted: "distorted";
                not_applicable: "not_applicable";
                preserved: "preserved";
                uncertain: "uncertain";
            }>;
            reason: z.ZodString;
        }, z.core.$strip>>;
        verdict: z.ZodEnum<{
            distorted: "distorted";
            preserved: "preserved";
            uncertain: "uncertain";
        }>;
        confidence: z.ZodEnum<{
            high: "high";
            low: "low";
            medium: "medium";
        }>;
        reason: z.ZodString;
    }, z.core.$strip>>>;
    finding_candidates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        node_ref: z.ZodString;
        type: z.ZodEnum<{
            addition: "addition";
            condition_change: "condition_change";
            distortion: "distortion";
            operator_change: "operator_change";
        }>;
        statement: z.ZodString;
        status: z.ZodEnum<{
            deferred: "deferred";
            dismissed: "dismissed";
            open: "open";
            resolved: "resolved";
        }>;
        resolution_ref: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    status: z.ZodEnum<{
        in_progress: "in_progress";
        modeled: "modeled";
        needs_review: "needs_review";
    }>;
}, z.core.$strip>;
export type NodeGroup = z.infer<typeof nodeGroupSchema>;
/**
 * Decidable cross-check: a Node claiming `origin: source` must point at a
 * decomposition item that itself has span_refs (i.e. is traceable to the
 * original prompt text). This is a structural consistency check, not a
 * semantic one — it does not confirm the statement is accurate, only that
 * the origin label isn't contradicted by an empty reference list.
 */
export declare function originMatchesSourceRefs(origin: Node['origin'], decompositionSpanRefs: string[]): boolean;
export declare function parseNodeGroup(yamlText: string): NodeGroup;
/** Same algorithm as Change 02's `stepsContentHash` — intentionally identical. */
export declare function nodeSetContentHash(steps: ClarificationSteps): string;
export type NodeGroupBlockReason = 'invalid_split_lineage' | 'missing_preservation_review' | 'invalid_source' | 'split_required' | 'incomplete_coverage' | 'atomicity_undetermined' | 'atomicity_final_mismatch' | 'open_risk_findings' | 'unresolved_distortion_check' | 'source_changed_since_modeling' | 'structural_signal_mismatch' | 'split_review_required' | 'restatement_mismatch' | 'invalid_reference';
export type NodeGroupJudgement = {
    status: 'modeled';
} | {
    status: 'needs_review';
    reasons: NodeGroupBlockReason[];
    detail: string[];
};
/**
 * The only authority on whether a NodeGroup is done. Mirrors Change 02's
 * `judgeCompletion()`: never trusts the stored `status`, recomputes
 * coverage, atomicity completeness, open risk findings, and the source hash
 * every call (Constitution 9).
 */
export declare function judgeNodeSetCompletion(group: NodeGroup, currentSteps: ClarificationSteps, source?: {
    clarification: Clarification;
    prompt: Prompt | undefined;
}): NodeGroupJudgement;
