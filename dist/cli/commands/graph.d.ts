import type { Command } from 'commander';
import type { Output } from '../output.js';
interface GraphBaseOptions {
    cwd?: string;
}
export declare function runGraphValidate(options: GraphBaseOptions, output: Output): Promise<void>;
export declare function runGraphImpactAll(output: Output): Promise<void>;
export declare function runGraphImpact(options: GraphBaseOptions & {
    node: string;
    outputPath?: string;
    checkReport?: string;
}, output: Output): Promise<void>;
export declare function runGraphTrace(options: GraphBaseOptions & {
    node: string;
}, output: Output): Promise<void>;
export declare function runGraphCandidateAdd(options: GraphBaseOptions & {
    input: string;
}, output: Output): Promise<void>;
export declare function runGraphCandidateList(options: GraphBaseOptions, output: Output): Promise<void>;
export declare function runGraphCandidateReview(options: GraphBaseOptions & {
    id: string;
    status: 'reviewed' | 'dismissed';
    statement: string;
    rationale: string;
}, output: Output): Promise<void>;
export declare function runGraphEdgeAdd(options: GraphBaseOptions & {
    input: string;
}, output: Output): Promise<void>;
export declare function runGraphEdgeConfirm(options: GraphBaseOptions & {
    id: string;
    response: 'agreed' | 'disagreed';
    statement: string;
    rationale: string;
}, output: Output): Promise<void>;
export declare function runGraphStatus(options: GraphBaseOptions, output: Output): Promise<void>;
export declare function registerGraphCommand(program: Command, output: Output): void;
export {};
