import { z } from 'zod';
export declare const assumptionInputSchema: z.ZodObject<{
    finding_ref: z.ZodString;
    finding_hash: z.ZodString;
    statement: z.ZodString;
    risk: z.ZodEnum<{
        critical: "critical";
        noncritical: "noncritical";
    }>;
    evidence_refs: z.ZodArray<z.ZodObject<{
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
}, z.core.$strict>;
export type AssumptionInput = z.infer<typeof assumptionInputSchema>;
export declare const assumptionSchema: z.ZodObject<{
    finding_ref: z.ZodString;
    finding_hash: z.ZodString;
    statement: z.ZodString;
    risk: z.ZodEnum<{
        critical: "critical";
        noncritical: "noncritical";
    }>;
    evidence_refs: z.ZodArray<z.ZodObject<{
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
    schema_version: z.ZodLiteral<1>;
    id: z.ZodString;
    fingerprint: z.ZodString;
    status: z.ZodEnum<{
        accepted_risk: "accepted_risk";
        disproven: "disproven";
        unverified: "unverified";
        verified: "verified";
    }>;
    decision_ref: z.ZodOptional<z.ZodString>;
    rationale: z.ZodOptional<z.ZodString>;
    created_at: z.ZodString;
    history: z.ZodArray<z.ZodObject<{
        at: z.ZodString;
        prior_status: z.ZodOptional<z.ZodEnum<{
            accepted_risk: "accepted_risk";
            disproven: "disproven";
            unverified: "unverified";
            verified: "verified";
        }>>;
        status: z.ZodEnum<{
            accepted_risk: "accepted_risk";
            disproven: "disproven";
            unverified: "unverified";
            verified: "verified";
        }>;
        decision_ref: z.ZodOptional<z.ZodString>;
        rationale: z.ZodString;
        record_hash: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type Assumption = z.infer<typeof assumptionSchema>;
export declare function createAssumption(value: unknown, now?: Date): Assumption;
export declare function transitionAssumption(value: unknown, next: 'verified' | 'disproven' | 'accepted_risk', decisionRef: string, rationale: string, now?: Date): Assumption;
