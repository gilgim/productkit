import { type ChallengeRun } from '../schema/challenge.js';
export declare function currentChallengeInputs(root: string): Promise<{
    inputs: Array<{
        kind: string;
        ref: string;
        content_hash: string;
    }>;
    scope: string[];
    unavailable: Array<{
        ref: string;
        reason: string;
    }>;
}>;
export declare function createChallengeRun(root: string): Promise<ChallengeRun>;
export declare function readChallengeRuns(root: string): Promise<ChallengeRun[]>;
export declare function validateChallengeRunReferences(root: string, run: ChallengeRun): Promise<string[]>;
export declare function updateChallengeRun(root: string, id: string, update: (run: ChallengeRun) => ChallengeRun): Promise<ChallengeRun>;
/** Names which inputs moved since a review started, so a stale error says why instead of only that it is stale. */
export declare function describeInputDrift(root: string, run: ChallengeRun): Promise<string[]>;
export declare const STALE_REVIEW_HINT = "A Finding added or confirmed, a changed Prompt, Node, Graph record or ImpactReport, and a changed challenge Skill make a review stale; `productkit decide resolve` does not. Finish Findings, user confirmations and `productkit graph impact --all` first, then run `productkit challenge review-start`.";
/** The review started last, by its start time: run IDs are content hashes, so file order says nothing about age. */
export declare function latestChallengeRun(runs: ChallengeRun[]): ChallengeRun | undefined;
export declare function refreshChallengeRun(root: string, run: ChallengeRun): Promise<{
    run: ChallengeRun;
    stale: boolean;
    completion: 'complete' | 'incomplete';
}>;
