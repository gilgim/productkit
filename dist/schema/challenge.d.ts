import { z } from 'zod';
export declare const challengeAreaSchema: z.ZodEnum<{
    condition_operator_consistency: "condition_operator_consistency";
    flow_gaps: "flow_gaps";
    graph_relation_risks: "graph_relation_risks";
    impact_coverage: "impact_coverage";
    missing_requirements_exceptions: "missing_requirements_exceptions";
    policy_conflicts_duplicates: "policy_conflicts_duplicates";
    prompt_node_fidelity: "prompt_node_fidelity";
    verifiability: "verifiability";
}>;
export declare const challengeAreaResultSchema: z.ZodObject<{
    status: z.ZodEnum<{
        not_applicable: "not_applicable";
        not_reviewed: "not_reviewed";
        reviewed: "reviewed";
    }>;
    rationale: z.ZodOptional<z.ZodString>;
    evidence_refs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            application: "application";
            clarification: "clarification";
            definition: "definition";
            edge: "edge";
            finding: "finding";
            impact_report: "impact_report";
            node: "node";
            node_group: "node_group";
            policy: "policy";
            prompt: "prompt";
            relation_candidate: "relation_candidate";
        }>;
        ref: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const challengeInputSchema: z.ZodObject<{
    kind: z.ZodString;
    ref: z.ZodString;
    content_hash: z.ZodString;
}, z.core.$strict>;
export declare const challengeHistorySchema: z.ZodObject<{
    event: z.ZodEnum<{
        checkpointed: "checkpointed";
        completed: "completed";
        created: "created";
        invalidated: "invalidated";
    }>;
    at: z.ZodString;
    statement: z.ZodString;
    content_hash: z.ZodString;
}, z.core.$strict>;
export declare const challengeRunSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<1>;
    id: z.ZodString;
    status: z.ZodEnum<{
        complete: "complete";
        in_progress: "in_progress";
        incomplete: "incomplete";
        stale: "stale";
    }>;
    scope: z.ZodObject<{
        included: z.ZodArray<z.ZodString>;
        excluded: z.ZodDefault<z.ZodArray<z.ZodObject<{
            ref: z.ZodString;
            reason: z.ZodString;
        }, z.core.$strict>>>;
    }, z.core.$strict>;
    areas: z.ZodRecord<z.ZodEnum<{
        condition_operator_consistency: "condition_operator_consistency";
        flow_gaps: "flow_gaps";
        graph_relation_risks: "graph_relation_risks";
        impact_coverage: "impact_coverage";
        missing_requirements_exceptions: "missing_requirements_exceptions";
        policy_conflicts_duplicates: "policy_conflicts_duplicates";
        prompt_node_fidelity: "prompt_node_fidelity";
        verifiability: "verifiability";
    }>, z.ZodObject<{
        status: z.ZodEnum<{
            not_applicable: "not_applicable";
            not_reviewed: "not_reviewed";
            reviewed: "reviewed";
        }>;
        rationale: z.ZodOptional<z.ZodString>;
        evidence_refs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                application: "application";
                clarification: "clarification";
                definition: "definition";
                edge: "edge";
                finding: "finding";
                impact_report: "impact_report";
                node: "node";
                node_group: "node_group";
                policy: "policy";
                prompt: "prompt";
                relation_candidate: "relation_candidate";
            }>;
            ref: z.ZodString;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    inputs: z.ZodArray<z.ZodObject<{
        kind: z.ZodString;
        ref: z.ZodString;
        content_hash: z.ZodString;
    }, z.core.$strict>>;
    finding_refs: z.ZodArray<z.ZodString>;
    unavailable_inputs: z.ZodArray<z.ZodObject<{
        ref: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strict>>;
    skill_version: z.ZodString;
    rules_version: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    review_hash: z.ZodString;
    history: z.ZodArray<z.ZodObject<{
        event: z.ZodEnum<{
            checkpointed: "checkpointed";
            completed: "completed";
            created: "created";
            invalidated: "invalidated";
        }>;
        at: z.ZodString;
        statement: z.ZodString;
        content_hash: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type ChallengeRun = z.infer<typeof challengeRunSchema>;
export declare const challengeAreas: ("condition_operator_consistency" | "flow_gaps" | "graph_relation_risks" | "impact_coverage" | "missing_requirements_exceptions" | "policy_conflicts_duplicates" | "prompt_node_fidelity" | "verifiability")[];
export declare function challengeRunHash(run: Omit<ChallengeRun, 'review_hash'> | (Omit<ChallengeRun, 'review_hash'> & {
    review_hash?: undefined;
})): string;
/** Areas that may be not_applicable, and only while the named artifact kind is absent. */
export declare const CHALLENGE_NOT_APPLICABLE: Partial<Record<z.infer<typeof challengeAreaSchema>, string>>;
/** What a reviewed area must cite: at least one of each group. */
export declare const CHALLENGE_AREA_EVIDENCE: Record<z.infer<typeof challengeAreaSchema>, string[][]>;
export declare function judgeChallengeCompletion(run: Pick<ChallengeRun, 'areas' | 'scope' | 'inputs' | 'unavailable_inputs' | 'status'>, presentKinds?: Set<string>): 'complete' | 'incomplete';
