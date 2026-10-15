import type { Journey, Policy } from '../schema/definition.js';
export declare function policyTextIssue(p: Policy, nodeSentences: string[], decisionStatements: string[]): string | undefined;
export declare function journeyTextIssue(j: Journey, nodeSentences: string[], decisionStatements: string[]): string | undefined;
