/**
 * The explicit list of what `productkit init` creates.
 *
 * The plan is declared rather than derived from walking templates/: a stray or
 * renamed template file should fail loudly at render time instead of silently
 * changing the generated workspace.
 */
/** Directory name holding every ProductKit artifact inside a target app. */
export declare const WORKSPACE_DIR = "product";
/** Artifact subdirectories, in the order of the workflow they serve. */
export declare const ARTIFACT_DIRS: readonly ['sources', 'discovery', 'nodes', 'graph', 'findings', 'proposals', 'decisions', 'journeys', 'policies', 'assumptions', 'reviews'];
export interface DirEntry {
    kind: 'dir';
    /** Path relative to the target root, using forward slashes. */
    relativePath: string;
}
/**
 * Where a planned file's contents come from.
 *
 * Templates are rendered with the init variables; skills are copied byte for
 * byte. Keeping the two apart means a stray `{{...}}` in a skill is never
 * silently substituted.
 */
export type FileSource = {
    from: 'template'; /** Relative to TEMPLATE_ROOT. */
    path: string;
} | {
    from: 'skill'; /** Relative to SKILL_ROOT. */
    path: string;
};
export interface FileEntry {
    kind: 'file';
    relativePath: string;
    source: FileSource;
}
export type PlanEntry = DirEntry | FileEntry;
export interface InitPlanOptions {
    /**
     * Install the agent skills alongside the workspace. On by default: a
     * workspace without them leaves the user with files no agent knows how to
     * drive.
     */
    skills?: boolean | undefined;
}
/**
 * Builds the full create plan. Order matters: a directory is always listed
 * before anything inside it.
 */
export declare function buildInitPlan(options?: InitPlanOptions): PlanEntry[];
