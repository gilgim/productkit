import { readDefinition, readPolicies, readJourneys } from './definition-store.js';
import { type ExportManifest } from '../schema/export.js';
export declare function convertDefinitionToOpenSpec(input: {
    changeId: string;
    capabilityId: string;
    definition: Awaited<ReturnType<typeof readDefinition>> extends infer T ? Exclude<T, undefined> : never;
    policies: Awaited<ReturnType<typeof readPolicies>>;
    journeys: Awaited<ReturnType<typeof readJourneys>>;
    approval: string;
    validation: string;
    warnings: string[];
    nodeText?: Map<string, string>;
    promptText?: Map<string, string[]>;
    asides?: string[];
    held?: string[];
    attestation?: string;
    approvalStatement?: string;
    approvalScope?: string;
    reviewNotes?: string[];
    decisionNotes?: string[];
    definitionNotes?: string[];
    decisionText?: Map<string, string>;
}): {
    proposal: string;
    spec: string;
};
export declare function exportOpenSpec(root: string, workspaceRoot: string, changeId: string, capabilityId?: string, now?: Date): Promise<{
    manifest: ExportManifest;
    created: boolean;
    files: string[];
}>;
