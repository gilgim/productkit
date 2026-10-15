import { z } from 'zod';
export declare const semanticAreas: z.ZodEnum<{
    acceptance_criteria: "acceptance_criteria";
    assumptions: "assumptions";
    counterexamples: "counterexamples";
    graph_impact: "graph_impact";
    policy_consistency: "policy_consistency";
    requirement_completeness: "requirement_completeness";
    traceability: "traceability";
    user_flow: "user_flow";
}>;
/** One verdict per (Definition item, source Node) pair: does the item say what the Node says? */
export declare const itemFidelitySchema: z.ZodObject<{
    item_ref: z.ZodString;
    node_ref: z.ZodString;
    verdict: z.ZodEnum<{
        broader: "broader";
        contradicts: "contradicts";
        narrower: "narrower";
        same: "same";
    }>;
    reason: z.ZodString;
}, z.core.$strict>;
export declare const semanticReviewSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<1>;
    id: z.ZodString;
    definition_ref: z.ZodString;
    definition_hash: z.ZodString;
    input_fingerprint: z.ZodString;
    assessor: z.ZodEnum<{
        ai: "ai";
        user: "user";
    }>;
    scope: z.ZodString;
    areas: z.ZodRecord<z.ZodEnum<{
        acceptance_criteria: "acceptance_criteria";
        assumptions: "assumptions";
        counterexamples: "counterexamples";
        graph_impact: "graph_impact";
        policy_consistency: "policy_consistency";
        requirement_completeness: "requirement_completeness";
        traceability: "traceability";
        user_flow: "user_flow";
    }>, z.ZodObject<{
        status: z.ZodEnum<{
            not_applicable: "not_applicable";
            not_reviewed: "not_reviewed";
            reviewed: "reviewed";
        }>;
        evidence_refs: z.ZodArray<z.ZodObject<{
            kind: z.ZodString;
            ref: z.ZodString;
            content_hash: z.ZodString;
        }, z.core.$strict>>;
        rationale: z.ZodString;
    }, z.core.$strict>>;
    item_fidelity: z.ZodDefault<z.ZodArray<z.ZodObject<{
        item_ref: z.ZodString;
        node_ref: z.ZodString;
        verdict: z.ZodEnum<{
            broader: "broader";
            contradicts: "contradicts";
            narrower: "narrower";
            same: "same";
        }>;
        reason: z.ZodString;
    }, z.core.$strict>>>;
    unreviewed_scope_resolved: z.ZodDefault<z.ZodArray<z.ZodObject<{
        item: z.ZodString;
        evidence_refs: z.ZodArray<z.ZodObject<{
            kind: z.ZodString;
            ref: z.ZodString;
            content_hash: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>>;
    finding_refs: z.ZodArray<z.ZodString>;
    unreviewed_scope: z.ZodArray<z.ZodString>;
    uncertainty: z.ZodArray<z.ZodString>;
    summary: z.ZodString;
    created_at: z.ZodString;
    content_hash: z.ZodString;
}, z.core.$strict>;
export declare const validationCheckSchema: z.ZodObject<{
    id: z.ZodString;
    category: z.ZodEnum<{
        application: "application";
        assumption: "assumption";
        decision: "decision";
        finding: "finding";
        impact: "impact";
        journey: "journey";
        policy: "policy";
        semantic: "semantic";
        structure: "structure";
        traceability: "traceability";
    }>;
    status: z.ZodEnum<{
        fail: "fail";
        not_assessed: "not_assessed";
        pass: "pass";
        stale: "stale";
        warn: "warn";
    }>;
    message: z.ZodString;
    refs: z.ZodArray<z.ZodObject<{
        kind: z.ZodString;
        ref: z.ZodString;
        content_hash: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const validationReportSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<1>;
    id: z.ZodString;
    definition_ref: z.ZodString;
    definition_hash: z.ZodString;
    rules_version: z.ZodString;
    input_snapshot: z.ZodArray<z.ZodObject<{
        kind: z.ZodString;
        ref: z.ZodString;
        content_hash: z.ZodString;
    }, z.core.$strict>>;
    input_fingerprint: z.ZodString;
    checks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        category: z.ZodEnum<{
            application: "application";
            assumption: "assumption";
            decision: "decision";
            finding: "finding";
            impact: "impact";
            journey: "journey";
            policy: "policy";
            semantic: "semantic";
            structure: "structure";
            traceability: "traceability";
        }>;
        status: z.ZodEnum<{
            fail: "fail";
            not_assessed: "not_assessed";
            pass: "pass";
            stale: "stale";
            warn: "warn";
        }>;
        message: z.ZodString;
        refs: z.ZodArray<z.ZodObject<{
            kind: z.ZodString;
            ref: z.ZodString;
            content_hash: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    structural_status: z.ZodEnum<{
        blocked: "blocked";
        pass: "pass";
    }>;
    semantic_status: z.ZodEnum<{
        inconclusive: "inconclusive";
        not_assessed: "not_assessed";
        pass: "pass";
        stale: "stale";
    }>;
    readiness: z.ZodEnum<{
        blocked: "blocked";
        ready: "ready";
        stale: "stale";
    }>;
    review_ref: z.ZodOptional<z.ZodString>;
    created_at: z.ZodString;
    report_hash: z.ZodString;
}, z.core.$strict>;
export declare const approvalSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<1>;
    id: z.ZodString;
    definition_ref: z.ZodString;
    definition_hash: z.ZodString;
    validation_ref: z.ZodString;
    validation_hash: z.ZodString;
    input_fingerprint: z.ZodString;
    user_statement: z.ZodString;
    scope: z.ZodString;
    attestation: z.ZodEnum<{
        flag: "flag";
        tty: "tty";
    }>;
    created_at: z.ZodString;
    supersedes_ref: z.ZodOptional<z.ZodString>;
    entry_hash: z.ZodString;
}, z.core.$strict>;
export type SemanticReview = z.infer<typeof semanticReviewSchema>;
export type ValidationReport = z.infer<typeof validationReportSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export declare function parseSemanticReview(s: string): SemanticReview;
export declare function parseValidationReport(s: string): ValidationReport;
export declare function parseApproval(s: string): Approval;
/**
 * A `reviewed` area must cite at least one product artifact. The skill file
 * itself is not evidence of having looked at the product. Returns the first
 * offending area, or undefined. Structural only: it cannot tell whether the
 * cited artifact is the right one for that area.
 */
/**
 * Which artifact kinds an area must cite to count as reviewed. "Cited
 * something" is not evidence of having looked at the right thing; this is
 * the minimum shape of the right thing. `anyOf` — at least one of these
 * kinds; `ifPresent` — required only when the workspace has that kind.
 */
export declare const AREA_EVIDENCE: Record<z.infer<typeof semanticAreas>, {
    allOf?: string[][];
    ifPresent?: string[];
    notApplicableWhenAbsent?: string;
}>;
export declare function semanticReviewIssue(review: Pick<SemanticReview, 'areas'>, presentKinds?: Set<string>): string | undefined;
export declare function createSemanticReview(v: Omit<SemanticReview, 'id' | 'content_hash'>): SemanticReview;
