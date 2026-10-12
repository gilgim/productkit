/**
 * The explicit list of what `productkit init` creates.
 *
 * The plan is declared rather than derived from walking templates/: a stray or
 * renamed template file should fail loudly at render time instead of silently
 * changing the generated workspace.
 */

/** Directory name holding every ProductKit artifact inside a target app. */
export const WORKSPACE_DIR = 'product';

/** Artifact subdirectories, in the order of the workflow they serve. */
export const ARTIFACT_DIRS = [
  'sources',
  'discovery',
  'nodes',
  'graph',
  'findings',
  'proposals',
  'decisions',
  'journeys',
  'policies',
  'assumptions',
  'reviews',
] as const;

export interface DirEntry {
  kind: 'dir';
  /** Path relative to the target root, using forward slashes. */
  relativePath: string;
}

export interface FileEntry {
  kind: 'file';
  relativePath: string;
  /** Path of the source template, relative to TEMPLATE_ROOT. */
  template: string;
}

export type PlanEntry = DirEntry | FileEntry;

function dir(relativePath: string): DirEntry {
  return { kind: 'dir', relativePath };
}

function file(relativePath: string, template: string): FileEntry {
  return { kind: 'file', relativePath, template };
}

/**
 * Builds the full create plan. Order matters: a directory is always listed
 * before anything inside it.
 */
export function buildInitPlan(): PlanEntry[] {
  const entries: PlanEntry[] = [
    dir(WORKSPACE_DIR),
    file(`${WORKSPACE_DIR}/config.yaml`, 'product/config.yaml'),
    file(`${WORKSPACE_DIR}/constitution.md`, 'product/constitution.md'),
    file(`${WORKSPACE_DIR}/overview.md`, 'product/overview.md'),
  ];

  for (const name of ARTIFACT_DIRS) {
    entries.push(dir(`${WORKSPACE_DIR}/${name}`));
    entries.push(
      file(`${WORKSPACE_DIR}/${name}/README.md`, `product/${name}/README.md`),
    );
  }

  return entries;
}
