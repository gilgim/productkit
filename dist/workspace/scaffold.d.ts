import { type TemplateVars } from './templates.js';
import { type PlanEntry } from './plan.js';
export type EntryAction = 'created' | 'skipped';
export interface AppliedEntry {
    relativePath: string;
    kind: PlanEntry['kind'];
    action: EntryAction;
}
export interface Conflict {
    relativePath: string;
    expected: PlanEntry['kind'];
    found: 'file' | 'dir' | 'other';
}
export interface ScaffoldResult {
    targetRoot: string;
    entries: AppliedEntry[];
    conflicts: Conflict[];
    dryRun: boolean;
}
export interface ScaffoldOptions {
    targetRoot: string;
    vars: TemplateVars;
    dryRun?: boolean;
    /** Install the agent skills into the target. Defaults to true. */
    skills?: boolean | undefined;
}
/**
 * Creates the product workspace.
 *
 * Runs in three phases — plan, conflict check, write — so a structural
 * conflict is diagnosed before anything is written. Existing files are never
 * overwritten (Constitution 10); writes use the `wx` flag so a file created
 * between the check and the write fails loudly instead of being clobbered.
 */
export declare function scaffoldWorkspace(options: ScaffoldOptions): Promise<ScaffoldResult>;
