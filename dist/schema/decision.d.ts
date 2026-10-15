import { z } from 'zod';
export declare const decisionInputSchema: z.ZodObject<{
    decision_type: z.ZodEnum<{
        content_decision: "content_decision";
        scope_exclusion: "scope_exclusion";
    }>;
    proposal_ref: z.ZodOptional<z.ZodString>;
    option_ref: z.ZodOptional<z.ZodString>;
    finding_refs: z.ZodArray<z.ZodObject<{
        finding_ref: z.ZodString;
        claim_hash: z.ZodString;
    }, z.core.$strict>>;
    selection: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"proposal_option">;
        proposal_ref: z.ZodString;
        option_ref: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"direct_user_decision">;
        text: z.ZodString;
    }, z.core.$strict>], "kind">;
    user_statement: z.ZodString;
    rationale: z.ZodString;
    scope: z.ZodString;
    attestation: z.ZodDefault<z.ZodEnum<{
        flag: "flag";
        tty: "tty";
    }>>;
    input_snapshot: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            clarification: "clarification";
            edge: "edge";
            finding: "finding";
            graph: "graph";
            impact_report: "impact_report";
            node: "node";
            node_group: "node_group";
            policy: "policy";
            prompt: "prompt";
            proposal: "proposal";
            relation_candidate: "relation_candidate";
        }>;
        ref: z.ZodString;
        content_hash: z.ZodString;
    }, z.core.$strict>>;
    scope_exclusion: z.ZodOptional<z.ZodObject<{
        excluded_scope: z.ZodString;
        impact: z.ZodString;
        residual_risk: z.ZodString;
    }, z.core.$strict>>;
    supersedes_decision_ref: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type DecisionInput = z.infer<typeof decisionInputSchema>;
export declare const decisionSchema: z.ZodObject<{
    decision_type: z.ZodEnum<{
        content_decision: "content_decision";
        scope_exclusion: "scope_exclusion";
    }>;
    proposal_ref: z.ZodOptional<z.ZodString>;
    option_ref: z.ZodOptional<z.ZodString>;
    finding_refs: z.ZodArray<z.ZodObject<{
        finding_ref: z.ZodString;
        claim_hash: z.ZodString;
    }, z.core.$strict>>;
    selection: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"proposal_option">;
        proposal_ref: z.ZodString;
        option_ref: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"direct_user_decision">;
        text: z.ZodString;
    }, z.core.$strict>], "kind">;
    user_statement: z.ZodString;
    rationale: z.ZodString;
    scope: z.ZodString;
    attestation: z.ZodDefault<z.ZodEnum<{
        flag: "flag";
        tty: "tty";
    }>>;
    input_snapshot: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            clarification: "clarification";
            edge: "edge";
            finding: "finding";
            graph: "graph";
            impact_report: "impact_report";
            node: "node";
            node_group: "node_group";
            policy: "policy";
            prompt: "prompt";
            proposal: "proposal";
            relation_candidate: "relation_candidate";
        }>;
        ref: z.ZodString;
        content_hash: z.ZodString;
    }, z.core.$strict>>;
    scope_exclusion: z.ZodOptional<z.ZodObject<{
        excluded_scope: z.ZodString;
        impact: z.ZodString;
        residual_risk: z.ZodString;
    }, z.core.$strict>>;
    supersedes_decision_ref: z.ZodOptional<z.ZodString>;
    schema_version: z.ZodLiteral<1>;
    id: z.ZodString;
    decision_hash: z.ZodString;
    application_status: z.ZodLiteral<"pending_application">;
    created_at: z.ZodString;
    history: z.ZodArray<z.ZodObject<{
        event: z.ZodLiteral<"recorded">;
        at: z.ZodString;
        decision_hash: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type Decision = z.infer<typeof decisionSchema>;
export declare function createDecision(value: unknown, now?: Date): Decision;
export declare function parseDecision(text: string): Decision;
