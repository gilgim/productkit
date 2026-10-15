/**
 * The explicit list of what `productkit init` creates.
 *
 * The plan is declared rather than derived from walking templates/: a stray or
 * renamed template file should fail loudly at render time instead of silently
 * changing the generated workspace.
 */

import { AGENT_SKILL_DIRS, SKILL_NAMES } from './skills.js';

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

/**
 * Where a planned file's contents come from.
 *
 * Templates are rendered with the init variables; skills are copied byte for
 * byte. Keeping the two apart means a stray `{{...}}` in a skill is never
 * silently substituted.
 */
export type FileSource =
  | { from: 'template'; /** Relative to TEMPLATE_ROOT. */ path: string }
  | { from: 'skill'; /** Relative to SKILL_ROOT. */ path: string };

export interface FileEntry {
  kind: 'file';
  relativePath: string;
  source: FileSource;
}

export type PlanEntry = DirEntry | FileEntry;

function dir(relativePath: string): DirEntry {
  return { kind: 'dir', relativePath };
}

function file(relativePath: string, template: string): FileEntry {
  return { kind: 'file', relativePath, source: { from: 'template', path: template } };
}

function skillFile(relativePath: string, skillPath: string): FileEntry {
  return { kind: 'file', relativePath, source: { from: 'skill', path: skillPath } };
}

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
export function buildInitPlan(options: InitPlanOptions = {}): PlanEntry[] {
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

  if (options.skills ?? true) {
    for (const agentDir of AGENT_SKILL_DIRS) {
      // Both path segments are planned so the conflict check sees a file
      // sitting where a directory belongs before anything is written.
      const agentRoot = agentDir.slice(0, agentDir.indexOf('/'));
      entries.push(dir(agentRoot));
      entries.push(dir(agentDir));
      for (const skill of SKILL_NAMES) {
        entries.push(dir(`${agentDir}/${skill}`));
        entries.push(
          skillFile(`${agentDir}/${skill}/SKILL.md`, `${skill}/SKILL.md`),
        );
      }
    }
  }

  return entries;
}
