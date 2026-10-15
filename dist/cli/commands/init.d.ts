import type { Output } from '../output.js';
export interface InitOptions {
    /** Target directory. Defaults to the current working directory. */
    targetPath?: string | undefined;
    /** Product name written into config.yaml. Defaults to the directory name. */
    name?: string | undefined;
    dryRun?: boolean | undefined;
    /** Install the agent skills into the target. Defaults to true. */
    skills?: boolean | undefined;
    /** Injected for tests; defaults to the real clock. */
    now?: Date | undefined;
    cwd?: string | undefined;
}
export declare function runInit(options: InitOptions, output: Output): Promise<void>;
