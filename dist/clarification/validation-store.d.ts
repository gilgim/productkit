import { type SemanticReview, type ValidationReport, type Approval } from '../schema/validation.js';
export declare function currentValidationFingerprint(root: string, rulesVersion?: string): Promise<{
    snapshot: Array<{
        kind: string;
        ref: string;
        content_hash: string;
    }>;
    fingerprint: string;
}>;
export declare function recordSemanticReview(root: string, input: Omit<SemanticReview, 'id' | 'content_hash'>): Promise<SemanticReview>;
export declare function createValidationReport(root: string, reviewId?: string, now?: Date): Promise<ValidationReport>;
export declare function readValidationReports(root: string): Promise<{
    schema_version: 1;
    id: string;
    definition_ref: string;
    definition_hash: string;
    rules_version: string;
    input_snapshot: {
        kind: string;
        ref: string;
        content_hash: string;
    }[];
    input_fingerprint: string;
    checks: {
        id: string;
        category: "application" | "assumption" | "decision" | "finding" | "impact" | "journey" | "policy" | "semantic" | "structure" | "traceability";
        status: "fail" | "not_assessed" | "pass" | "stale" | "warn";
        message: string;
        refs: {
            kind: string;
            ref: string;
            content_hash: string;
        }[];
    }[];
    structural_status: "blocked" | "pass";
    semantic_status: "inconclusive" | "not_assessed" | "pass" | "stale";
    readiness: "blocked" | "ready" | "stale";
    review_ref?: string | undefined;
    created_at: string;
    report_hash: string;
}[]>;
export declare function reportFreshness(root: string, report: ValidationReport): Promise<boolean>;
export declare function recordApproval(root: string, reportId: string, userStatement: string, scope: string, attestation?: 'tty' | 'flag', now?: Date): Promise<Approval>;
export declare function readApprovals(root: string): Promise<{
    schema_version: 1;
    id: string;
    definition_ref: string;
    definition_hash: string;
    validation_ref: string;
    validation_hash: string;
    input_fingerprint: string;
    user_statement: string;
    scope: string;
    attestation: "flag" | "tty";
    created_at: string;
    supersedes_ref?: string | undefined;
    entry_hash: string;
}[]>;
/** The current Approval is the one no other Approval supersedes. Two heads, or a head whose supersedes_ref does not resolve, is a forged or orphaned record. */
export declare function currentApprovalHead(approvals: Approval[]): {
    head?: Approval;
    issue?: string;
};
export declare function approvalStatus(root: string): Promise<{
    status: 'stale';
    approval: {
        schema_version: 1;
        id: string;
        definition_ref: string;
        definition_hash: string;
        validation_ref: string;
        validation_hash: string;
        input_fingerprint: string;
        user_statement: string;
        scope: string;
        attestation: "flag" | "tty";
        created_at: string;
        supersedes_ref?: string | undefined;
        entry_hash: string;
    };
    issue: string;
} | {
    issue?: never;
    status: 'missing';
    approval?: never;
} | {
    issue?: never;
    status: 'stale';
    approval: {
        schema_version: 1;
        id: string;
        definition_ref: string;
        definition_hash: string;
        validation_ref: string;
        validation_hash: string;
        input_fingerprint: string;
        user_statement: string;
        scope: string;
        attestation: "flag" | "tty";
        created_at: string;
        supersedes_ref?: string | undefined;
        entry_hash: string;
    };
} | {
    issue?: never;
    status: 'valid';
    approval: {
        schema_version: 1;
        id: string;
        definition_ref: string;
        definition_hash: string;
        validation_ref: string;
        validation_hash: string;
        input_fingerprint: string;
        user_statement: string;
        scope: string;
        attestation: "flag" | "tty";
        created_at: string;
        supersedes_ref?: string | undefined;
        entry_hash: string;
    };
}>;
