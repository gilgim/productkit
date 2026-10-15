import { z } from 'zod';
export declare const GRAPH_RULES_VERSION = "graph-impact/1";
export declare const graphRelationTypeSchema: z.ZodEnum<{
    conflicts_with: "conflicts_with";
    depends_on: "depends_on";
    duplicates: "duplicates";
    exception_of: "exception_of";
    precedes: "precedes";
    supersedes: "supersedes";
}>;
export type GraphRelationType = z.infer<typeof graphRelationTypeSchema>;
export declare const edgeConfirmationSchema: z.ZodObject<{
    id: z.ZodString;
    edge_ref: z.ZodString;
    edge_claim_hash: z.ZodString;
    endpoint_snapshot_hashes: z.ZodObject<{
        source: z.ZodString;
        target: z.ZodString;
    }, z.core.$strip>;
    user_response: z.ZodEnum<{
        agreed: "agreed";
        disagreed: "disagreed";
    }>;
    user_statement: z.ZodString;
    rationale: z.ZodString;
    checked_at: z.ZodString;
    entry_hash: z.ZodString;
}, z.core.$strict>;
export type EdgeConfirmation = z.infer<typeof edgeConfirmationSchema>;
export declare const graphEdgeSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        conflicts_with: "conflicts_with";
        depends_on: "depends_on";
        duplicates: "duplicates";
        exception_of: "exception_of";
        precedes: "precedes";
        supersedes: "supersedes";
    }>;
    source: z.ZodString;
    target: z.ZodString;
    basis: z.ZodEnum<{
        ai_inferred: "ai_inferred";
        explicit_text: "explicit_text";
    }>;
    reason: z.ZodString;
    status: z.ZodEnum<{
        confirmed: "confirmed";
        proposed: "proposed";
        rejected: "rejected";
    }>;
    confirmations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        edge_ref: z.ZodString;
        edge_claim_hash: z.ZodString;
        endpoint_snapshot_hashes: z.ZodObject<{
            source: z.ZodString;
            target: z.ZodString;
        }, z.core.$strip>;
        user_response: z.ZodEnum<{
            agreed: "agreed";
            disagreed: "disagreed";
        }>;
        user_statement: z.ZodString;
        rationale: z.ZodString;
        checked_at: z.ZodString;
        entry_hash: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export declare const graphDocumentSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<1>;
    edges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            conflicts_with: "conflicts_with";
            depends_on: "depends_on";
            duplicates: "duplicates";
            exception_of: "exception_of";
            precedes: "precedes";
            supersedes: "supersedes";
        }>;
        source: z.ZodString;
        target: z.ZodString;
        basis: z.ZodEnum<{
            ai_inferred: "ai_inferred";
            explicit_text: "explicit_text";
        }>;
        reason: z.ZodString;
        status: z.ZodEnum<{
            confirmed: "confirmed";
            proposed: "proposed";
            rejected: "rejected";
        }>;
        confirmations: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            edge_ref: z.ZodString;
            edge_claim_hash: z.ZodString;
            endpoint_snapshot_hashes: z.ZodObject<{
                source: z.ZodString;
                target: z.ZodString;
            }, z.core.$strip>;
            user_response: z.ZodEnum<{
                agreed: "agreed";
                disagreed: "disagreed";
            }>;
            user_statement: z.ZodString;
            rationale: z.ZodString;
            checked_at: z.ZodString;
            entry_hash: z.ZodString;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type GraphDocument = z.infer<typeof graphDocumentSchema>;
export declare const candidateEvidenceRefSchema: z.ZodObject<{
    ref: z.ZodString;
    kind: z.ZodEnum<{
        clarification: "clarification";
        node: "node";
        prompt: "prompt";
        span: "span";
    }>;
}, z.core.$strict>;
export declare const candidateReviewEntrySchema: z.ZodObject<{
    id: z.ZodString;
    candidate_ref: z.ZodString;
    candidate_hash: z.ZodString;
    review_status: z.ZodEnum<{
        dismissed: "dismissed";
        reviewed: "reviewed";
    }>;
    user_statement: z.ZodString;
    rationale: z.ZodString;
    checked_at: z.ZodString;
    entry_hash: z.ZodString;
}, z.core.$strict>;
export declare const relationCandidateSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<1>;
    id: z.ZodString;
    original_relation_name: z.ZodString;
    source_node_ref: z.ZodString;
    target_node_ref: z.ZodString;
    proposed_meaning: z.ZodString;
    evidence_refs: z.ZodArray<z.ZodObject<{
        ref: z.ZodString;
        kind: z.ZodEnum<{
            clarification: "clarification";
            node: "node";
            prompt: "prompt";
            span: "span";
        }>;
    }, z.core.$strict>>;
    review_status: z.ZodEnum<{
        dismissed: "dismissed";
        pending: "pending";
        reviewed: "reviewed";
    }>;
    created_at: z.ZodString;
    endpoint_snapshot_hashes: z.ZodObject<{
        source: z.ZodString;
        target: z.ZodString;
    }, z.core.$strict>;
    candidate_hash: z.ZodString;
    review_history: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        candidate_ref: z.ZodString;
        candidate_hash: z.ZodString;
        review_status: z.ZodEnum<{
            dismissed: "dismissed";
            reviewed: "reviewed";
        }>;
        user_statement: z.ZodString;
        rationale: z.ZodString;
        checked_at: z.ZodString;
        entry_hash: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export type RelationCandidate = z.infer<typeof relationCandidateSchema>;
export interface RelationCandidateInput {
    original_relation_name: string;
    source_node_ref: string;
    target_node_ref: string;
    proposed_meaning: string;
    evidence_refs: Array<z.infer<typeof candidateEvidenceRefSchema>>;
    endpoint_snapshot_hashes: {
        source: string;
        target: string;
    };
    created_at: string;
}
export declare function relationCandidateFingerprint(input: RelationCandidateInput): string;
export declare function createRelationCandidate(input: RelationCandidateInput): RelationCandidate;
export declare function parseGraphDocument(text: string): GraphDocument;
export declare function parseRelationCandidate(text: string): RelationCandidate;
export declare function graphEdgeClaimHash(edge: Omit<GraphEdge, 'confirmations'> | GraphEdge): string;
export declare function confirmationEntryHash(entry: Omit<EdgeConfirmation, 'entry_hash'>): string;
export declare function candidateReviewEntryHash(entry: Omit<z.infer<typeof candidateReviewEntrySchema>, 'entry_hash'>): string;
export declare function relationKindAllowed(type: GraphRelationType, sourceKind: string, targetKind: string): boolean;
export declare const symmetricRelationTypes: ReadonlySet<GraphRelationType>;
export declare const acyclicRelationTypes: ReadonlySet<GraphRelationType>;
