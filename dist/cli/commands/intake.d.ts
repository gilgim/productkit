import type { Output } from '../output.js';
export interface IntakeOptions {
    text?: string | undefined;
    file?: string | undefined;
    cwd?: string | undefined;
    now?: Date | undefined;
}
export declare function runIntake(options: IntakeOptions, output: Output): Promise<void>;
