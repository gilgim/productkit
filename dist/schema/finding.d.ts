import { z } from 'zod';
export declare const findingTypeSchema: z.ZodEnum<{
    duplicate_policy: "duplicate_policy";
    flow_gap: "flow_gap";
    graph_relation_risk: "graph_relation_risk";
    impact_coverage_gap: "impact_coverage_gap";
    logical_inconsistency: "logical_inconsistency";
    missing_exception: "missing_exception";
    missing_requirement: "missing_requirement";
    other: "other";
    policy_conflict: "policy_conflict";
    semantic_distortion: "semantic_distortion";
    unverifiable_requirement: "unverifiable_requirement";
}>;
export declare const findingSeveritySchema: z.ZodEnum<{
    critical: "critical";
    major: "major";
    minor: "minor";
}>;
export declare const findingRefKindSchema: z.ZodEnum<{
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
export declare const findingRefSchema: z.ZodObject<{
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
}, z.core.$strict>;
export declare const findingEvidenceSchema: z.ZodObject<{
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
    detail: z.ZodString;
    source_hash: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const findingCounterexampleSchema: z.ZodObject<{
    condition: z.ZodString;
    expected: z.ZodString;
    observed: z.ZodString;
    status: z.ZodEnum<{
        hypothesis: "hypothesis";
        observed: "observed";
    }>;
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
export declare const findingAiAssessmentSchema: z.ZodObject<{
    is_ai_judgment: z.ZodLiteral<true>;
    rationale: z.ZodString;
    confidence: z.ZodEnum<{
        high: "high";
        low: "low";
        medium: "medium";
    }>;
    uncertainty: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const findingInputSchema: z.ZodObject<{
    issue_key: z.ZodString;
    type: z.ZodEnum<{
        duplicate_policy: "duplicate_policy";
        flow_gap: "flow_gap";
        graph_relation_risk: "graph_relation_risk";
        impact_coverage_gap: "impact_coverage_gap";
        logical_inconsistency: "logical_inconsistency";
        missing_exception: "missing_exception";
        missing_requirement: "missing_requirement";
        other: "other";
        policy_conflict: "policy_conflict";
        semantic_distortion: "semantic_distortion";
        unverifiable_requirement: "unverifiable_requirement";
    }>;
    severity: z.ZodEnum<{
        critical: "critical";
        major: "major";
        minor: "minor";
    }>;
    statement: z.ZodString;
    related_refs: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strict>>;
    evidence_refs: z.ZodArray<z.ZodObject<{
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
        detail: z.ZodString;
        source_hash: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    counterexamples: z.ZodArray<z.ZodObject<{
        condition: z.ZodString;
        expected: z.ZodString;
        observed: z.ZodString;
        status: z.ZodEnum<{
            hypothesis: "hypothesis";
            observed: "observed";
        }>;
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
    ai_assessment: z.ZodObject<{
        is_ai_judgment: z.ZodLiteral<true>;
        rationale: z.ZodString;
        confidence: z.ZodEnum<{
            high: "high";
            low: "low";
            medium: "medium";
        }>;
        uncertainty: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    questions: z.ZodArray<z.ZodString>;
    supersedes_finding_ref: z.ZodOptional<z.ZodString>;
    candidate_refs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        clarification_ref: z.ZodString;
        index: z.ZodNumber;
        span_refs: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export type FindingInput = z.infer<typeof findingInputSchema>;
export declare const findingReviewStatusSchema: z.ZodEnum<{
    confirmed: "confirmed";
    proposed: "proposed";
    rejected: "rejected";
}>;
export declare const findingResolutionStatusSchema: z.ZodEnum<{
    deferred: "deferred";
    dismissed: "dismissed";
    resolved: "resolved";
    unresolved: "unresolved";
}>;
export declare const findingConfirmationSchema: z.ZodObject<{
    id: z.ZodString;
    finding_ref: z.ZodString;
    finding_hash: z.ZodString;
    response: z.ZodEnum<{
        confirmed: "confirmed";
        rejected: "rejected";
    }>;
    user_statement: z.ZodString;
    rationale: z.ZodString;
    attestation: z.ZodDefault<z.ZodEnum<{
        flag: "flag";
        tty: "tty";
    }>>;
    checked_at: z.ZodString;
    entry_hash: z.ZodString;
}, z.core.$strict>;
export type FindingConfirmation = z.infer<typeof findingConfirmationSchema>;
export declare const findingHistoryEntrySchema: z.ZodObject<{
    id: z.ZodString;
    event: z.ZodEnum<{
        confirmation_recorded: "confirmation_recorded";
        created: "created";
        resolution_recorded: "resolution_recorded";
    }>;
    actor: z.ZodEnum<{
        agent: "agent";
        change06_decision: "change06_decision";
        user: "user";
    }>;
    prior_review_status: z.ZodOptional<z.ZodEnum<{
        confirmed: "confirmed";
        proposed: "proposed";
        rejected: "rejected";
    }>>;
    review_status: z.ZodEnum<{
        confirmed: "confirmed";
        proposed: "proposed";
        rejected: "rejected";
    }>;
    prior_resolution_status: z.ZodOptional<z.ZodEnum<{
        deferred: "deferred";
        dismissed: "dismissed";
        resolved: "resolved";
        unresolved: "unresolved";
    }>>;
    resolution_status: z.ZodEnum<{
        deferred: "deferred";
        dismissed: "dismissed";
        resolved: "resolved";
        unresolved: "unresolved";
    }>;
    finding_hash: z.ZodString;
    statement: z.ZodString;
    decision_ref: z.ZodOptional<z.ZodString>;
    recorded_at: z.ZodString;
    entry_hash: z.ZodString;
}, z.core.$strict>;
export type FindingHistoryEntry = z.infer<typeof findingHistoryEntrySchema>;
export declare const findingSchema: z.ZodObject<{
    issue_key: z.ZodString;
    type: z.ZodEnum<{
        duplicate_policy: "duplicate_policy";
        flow_gap: "flow_gap";
        graph_relation_risk: "graph_relation_risk";
        impact_coverage_gap: "impact_coverage_gap";
        logical_inconsistency: "logical_inconsistency";
        missing_exception: "missing_exception";
        missing_requirement: "missing_requirement";
        other: "other";
        policy_conflict: "policy_conflict";
        semantic_distortion: "semantic_distortion";
        unverifiable_requirement: "unverifiable_requirement";
    }>;
    severity: z.ZodEnum<{
        critical: "critical";
        major: "major";
        minor: "minor";
    }>;
    statement: z.ZodString;
    related_refs: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strict>>;
    evidence_refs: z.ZodArray<z.ZodObject<{
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
        detail: z.ZodString;
        source_hash: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    counterexamples: z.ZodArray<z.ZodObject<{
        condition: z.ZodString;
        expected: z.ZodString;
        observed: z.ZodString;
        status: z.ZodEnum<{
            hypothesis: "hypothesis";
            observed: "observed";
        }>;
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
    ai_assessment: z.ZodObject<{
        is_ai_judgment: z.ZodLiteral<true>;
        rationale: z.ZodString;
        confidence: z.ZodEnum<{
            high: "high";
            low: "low";
            medium: "medium";
        }>;
        uncertainty: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    questions: z.ZodArray<z.ZodString>;
    supersedes_finding_ref: z.ZodOptional<z.ZodString>;
    candidate_refs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        clarification_ref: z.ZodString;
        index: z.ZodNumber;
        span_refs: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>>;
    schema_version: z.ZodLiteral<1>;
    id: z.ZodString;
    fingerprint: z.ZodString;
    review_status: z.ZodEnum<{
        confirmed: "confirmed";
        proposed: "proposed";
        rejected: "rejected";
    }>;
    resolution_status: z.ZodEnum<{
        deferred: "deferred";
        dismissed: "dismissed";
        resolved: "resolved";
        unresolved: "unresolved";
    }>;
    confirmation_history: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        finding_ref: z.ZodString;
        finding_hash: z.ZodString;
        response: z.ZodEnum<{
            confirmed: "confirmed";
            rejected: "rejected";
        }>;
        user_statement: z.ZodString;
        rationale: z.ZodString;
        attestation: z.ZodDefault<z.ZodEnum<{
            flag: "flag";
            tty: "tty";
        }>>;
        checked_at: z.ZodString;
        entry_hash: z.ZodString;
    }, z.core.$strict>>>;
    decision_ref: z.ZodOptional<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    history: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        event: z.ZodEnum<{
            confirmation_recorded: "confirmation_recorded";
            created: "created";
            resolution_recorded: "resolution_recorded";
        }>;
        actor: z.ZodEnum<{
            agent: "agent";
            change06_decision: "change06_decision";
            user: "user";
        }>;
        prior_review_status: z.ZodOptional<z.ZodEnum<{
            confirmed: "confirmed";
            proposed: "proposed";
            rejected: "rejected";
        }>>;
        review_status: z.ZodEnum<{
            confirmed: "confirmed";
            proposed: "proposed";
            rejected: "rejected";
        }>;
        prior_resolution_status: z.ZodOptional<z.ZodEnum<{
            deferred: "deferred";
            dismissed: "dismissed";
            resolved: "resolved";
            unresolved: "unresolved";
        }>>;
        resolution_status: z.ZodEnum<{
            deferred: "deferred";
            dismissed: "dismissed";
            resolved: "resolved";
            unresolved: "unresolved";
        }>;
        finding_hash: z.ZodString;
        statement: z.ZodString;
        decision_ref: z.ZodOptional<z.ZodString>;
        recorded_at: z.ZodString;
        entry_hash: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type Finding = z.infer<typeof findingSchema>;
export declare function normalizeFindingText(value: string): string;
export declare function findingFingerprint(input: FindingInput): string;
export declare function findingContentHash(input: FindingInput): string;
export declare function findingConfirmationEntryHash(entry: Omit<FindingConfirmation, 'entry_hash'>): string;
export declare function findingHistoryEntryHash(entry: Omit<FindingHistoryEntry, 'entry_hash'>): string;
export declare function toFindingInput(finding: Finding | Omit<Finding, 'history' | 'confirmation_history' | 'review_status' | 'resolution_status' | 'decision_ref' | 'created_at' | 'updated_at' | 'schema_version' | 'id' | 'fingerprint'>): FindingInput;
export declare function createFinding(inputValue: unknown, now?: Date): Finding;
export declare function appendFindingConfirmation(findingValue: unknown, response: 'confirmed' | 'rejected', userStatement: string, rationale: string, now?: Date, attestation?: 'tty' | 'flag'): Finding;
export declare function parseFinding(yamlText: string): Finding;
