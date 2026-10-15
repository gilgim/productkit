import type { Policy } from '../schema/definition.js';
export type PolicyConsistencyClass = 'structural_error' | 'semantic_candidate' | 'explicit_exception_candidate' | 'replacement_candidate' | 'duplicate_candidate' | 'independent_conditions' | 'inconclusive';
export interface PolicyConsistencyResult {
    classification: PolicyConsistencyClass;
    policy_refs: [string, string];
    reason: string;
    overlap: 'disjoint' | 'possible' | 'unknown';
}
/** A structural candidate classifier only; it never confirms semantic conflict or chooses priority. */
export declare function classifyPolicyPair(left: Policy, right: Policy, exceptionLinked?: boolean): PolicyConsistencyResult;
