import type { Command } from 'commander';
import type { Output } from '../output.js';
/**
 * Links the single entry Skill into each Agent's user-level Skill folder so an
 * Agent knows ProductKit exists before anyone types a ProductKit command.
 *
 * This never touches the target app (init still writes only product/). It
 * writes one symlink per Agent and refuses to replace anything it did not
 * create: a real directory or file is always left alone, and a symlink that
 * points elsewhere is replaced only with --force (Constitution 10).
 */
export declare const ENTRY_SKILL = "productkit";
export declare const AGENTS: readonly ['claude', 'codex'];
export type AgentName = (typeof AGENTS)[number];
export interface SetupOptions {
    agent?: AgentName | 'all' | undefined;
    remove?: boolean | undefined;
    dryRun?: boolean | undefined;
    force?: boolean | undefined;
    env?: NodeJS.ProcessEnv | undefined;
    home?: string | undefined;
    /** Entry Skill directory to link; defaults to the installed skills/productkit. */
    source?: string | undefined;
}
export type SetupAction = 'linked' | 'already_linked' | 'replaced' | 'removed' | 'not_linked' | 'skipped_no_config' | 'conflict' | 'error';
export interface SetupEntry {
    agent: AgentName;
    linkPath: string;
    source: string;
    action: SetupAction;
    dryRun: boolean;
    detail?: string;
}
export declare function agentConfigDir(agent: AgentName, env: NodeJS.ProcessEnv, home: string): string;
export declare function setupAgents(options?: SetupOptions): Promise<SetupEntry[]>;
export declare function formatSetupEntry(entry: SetupEntry): string;
export declare function runSetup(options: SetupOptions, output: Output): Promise<void>;
export declare function registerSetupCommand(program: Command, output: Output): void;
