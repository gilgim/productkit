import type { Output } from '../output.js';
export interface ModelOptions {
    clarification?: string | undefined;
    cwd?: string | undefined;
}
export declare function runModel(options: ModelOptions, output: Output): Promise<void>;
