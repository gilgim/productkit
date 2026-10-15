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
export declare function refreshChallengeRun(root: string, run: ChallengeRun): Promise<{
    run: ChallengeRun;
    stale: boolean;
    completion: 'complete' | 'incomplete';
}>;
