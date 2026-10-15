import { type GraphEdge, type GraphRelationType, type RelationCandidate } from '../schema/graph.js';
import { type ImpactReport } from '../schema/impact.js';
import { type GraphNodeRecord, type GraphWorkspaceSnapshot } from './provenance.js';
export interface GraphIssue {
    code: string;
    ref: string;
    detail: string;
}
export interface EffectiveEdge {
    edge: GraphEdge;
    status: 'confirmed' | 'proposed' | 'rejected';
    freshness: 'fresh' | 'stale';
    sourceSnapshotHash?: string;
    targetSnapshotHash?: string;
    issues: GraphIssue[];
}
export declare function canonicalizeEdgeEndpoints(type: GraphRelationType, source: string, target: string): {
    source: string;
    target: string;
};
export declare function edgeSnapshotHash(record: GraphNodeRecord): string;
export declare function effectiveEdge(edge: GraphEdge, nodes: Map<string, GraphNodeRecord>): EffectiveEdge;
export declare function validateGraph(edges: GraphEdge[], nodes: Map<string, GraphNodeRecord>): GraphIssue[];
export declare function validateConfirmation(edge: GraphEdge, nodes: Map<string, GraphNodeRecord>, userResponse: 'agreed' | 'disagreed', userStatement: string, rationale: string, checkedAt: string): {
    id: string;
    edge_ref: string;
    edge_claim_hash: string;
    endpoint_snapshot_hashes: {
        source: string;
        target: string;
    };
    user_response: "agreed" | "disagreed";
    user_statement: string;
    rationale: string;
    checked_at: string;
    entry_hash: string;
};
export interface ImpactInput {
    seedNodeId: string;
    graphEdges: GraphEdge[];
    candidates: RelationCandidate[];
    workspace: GraphWorkspaceSnapshot;
    createdAt: string;
}
export declare function computeImpactReport(input: ImpactInput): ImpactReport;
