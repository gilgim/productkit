import type { Output } from '../output.js';
export interface InstallSkillsOptions {
    force?: boolean | undefined;
    /** Injected for tests; defaults to the user's home directory. */
    home?: string | undefined;
}
/**
 * Copies every skill into the user-level agent skill folders so Claude Code and
 * Codex see ProductKit in any project, with no per-project `init` first.
 * Existing files are kept unless --force, so local edits survive.
 */
export declare function runInstallSkills(options: InstallSkillsOptions, output: Output): Promise<void>;
/** Silent first-run install: only when the entry skill is missing. */
export declare function ensureGlobalSkills(home?: string): Promise<void>;
