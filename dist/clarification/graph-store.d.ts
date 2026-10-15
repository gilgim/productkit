import { type GraphDocument, type RelationCandidate, type RelationCandidateInput } from '../schema/graph.js';
export declare function readGraphDocument(productRoot: string): Promise<{
    graph: GraphDocument;
    text?: string;
}>;
export declare function readRelationCandidates(productRoot: string): Promise<RelationCandidate[]>;
export declare function addRelationCandidate(productRoot: string, input: Omit<RelationCandidateInput, 'endpoint_snapshot_hashes' | 'created_at'>, now?: Date): Promise<{
    candidate: RelationCandidate;
    created: boolean;
}>;
export declare function reviewRelationCandidate(productRoot: string, id: string, status: 'reviewed' | 'dismissed', userStatement: string, rationale: string, now?: Date): Promise<RelationCandidate>;
export declare function writeGraphDocument(productRoot: string, graph: GraphDocument): Promise<void>;
export declare function updateGraphDocument(productRoot: string, updater: (graph: GraphDocument) => GraphDocument): Promise<GraphDocument>;
