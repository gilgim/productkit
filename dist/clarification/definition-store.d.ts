import { type Application, type Journey, type Policy, type ProductDefinition } from '../schema/definition.js';
export declare function addPolicy(root: string, value: unknown): Promise<{
    policy: Policy;
    created: boolean;
}>;
export declare function readPolicies(root: string): Promise<Policy[]>;
export declare function validatePolicyReferences(root: string, policy: Policy): Promise<void>;
export declare function addDefinition(root: string, value: unknown): Promise<{
    definition: ProductDefinition;
    created: boolean;
}>;
export declare function validateDefinitionReferences(root: string, definition: ProductDefinition): Promise<void>;
/**
 * An exclusion item is only as real as the scope_exclusion Decision it cites:
 * the Decision must exist, be current, be of that type, and say the same
 * excluded scope / impact / residual risk the item repeats.
 */
export declare function validateExclusionItems(root: string, definition: ProductDefinition): Promise<void>;
export declare function addJourney(root: string, value: unknown): Promise<{
    journey: Journey;
    created: boolean;
}>;
export declare function readJourneys(root: string): Promise<Journey[]>;
export declare function readDefinition(root: string): Promise<ProductDefinition | undefined>;
export declare function createApplication(root: string, value: unknown, now?: Date): Promise<{
    application: Application;
    created: boolean;
}>;
export declare function readApplications(root: string): Promise<Application[]>;
export declare function applyApplication(root: string, id: string, now?: Date): Promise<Application>;
export declare function rollbackApplication(root: string, id: string, now?: Date): Promise<Application>;
export declare function recordApplicationVerification(root: string, id: string, input: {
    status: 'verified' | 'failed' | 'inconclusive';
    assessor: 'ai' | 'user';
    summary: string;
    evidence_refs: unknown[];
    uncertainty: string[];
}, now?: Date): Promise<Application>;
export declare function applicationFreshness(root: string, app: Application): Promise<{
    stale: boolean;
    reasons: string[];
}>;
