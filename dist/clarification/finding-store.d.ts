import { type Finding, type FindingInput } from '../schema/finding.js';
export declare function readFindings(root: string): Promise<Finding[]>;
export declare function validateFindingReferences(root: string, finding: Finding): Promise<string[]>;
export declare function addFinding(root: string, input: FindingInput): Promise<{
    finding: Finding;
    created: boolean;
}>;
export declare function confirmFinding(root: string, id: string, response: 'confirmed' | 'rejected', statement: string, rationale: string, attestation?: 'tty' | 'flag', caveat?: string): Promise<Finding>;
