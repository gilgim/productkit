import { type Node } from '../schema/node.js';
import { type Prompt } from '../schema/prompt.js';
export interface GraphNodeRecord {
    node: Node;
    node_group_ref: string;
    node_group_hash: string;
    clarification_ref: string;
    clarification_hash: string;
    prompt_ref: string;
    prompt_hash: string;
    prompt_spans_hash: string;
}
export interface ProvenanceIssue {
    code: string;
    ref: string;
    reason: string;
}
export interface GraphWorkspaceSnapshot {
    schema_version: 0 | 1;
    prompts: Map<string, Prompt>;
    nodes: Map<string, GraphNodeRecord>;
    node_snapshot_hashes: Map<string, string>;
    issues: ProvenanceIssue[];
    fingerprint: string;
}
export declare function graphNodeSnapshotHash(record: GraphNodeRecord): string;
export declare function loadGraphWorkspace(productRoot: string): Promise<GraphWorkspaceSnapshot>;
