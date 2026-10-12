import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { CliError, describeCause } from '../errors.js';
import { loadTemplate, type TemplateVars } from './templates.js';
import { buildInitPlan, type PlanEntry } from './plan.js';

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
}

async function inspect(absolutePath: string): Promise<'file' | 'dir' | 'other' | 'missing'> {
  try {
    const info = await stat(absolutePath);
    if (info.isDirectory()) return 'dir';
    if (info.isFile()) return 'file';
    return 'other';
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code;
    // ENOTDIR means a parent segment is a file. That parent is itself a planned
    // path, so it gets reported as the conflict; this path simply cannot exist.
    if (code === 'ENOENT' || code === 'ENOTDIR') return 'missing';
    throw new CliError(
      `Could not inspect ${absolutePath}: ${describeCause(cause)}`,
    );
  }
}

/**
 * Makes sure the target root exists and is a directory.
 * A regular file at the target path is a structural conflict, not something to
 * work around.
 */
async function ensureTargetRoot(targetRoot: string): Promise<void> {
  const found = await inspect(targetRoot);
  if (found === 'dir') return;
  if (found !== 'missing') {
    throw new CliError(
      `Target path is not a directory: ${targetRoot}`,
      undefined,
      [`Found a ${found} where a directory is required.`],
    );
  }
  try {
    await mkdir(targetRoot, { recursive: true });
  } catch (cause) {
    throw new CliError(
      `Could not create target directory ${targetRoot}: ${describeCause(cause)}`,
    );
  }
}

/**
 * Creates the product workspace.
 *
 * Runs in three phases — plan, conflict check, write — so a structural
 * conflict is diagnosed before anything is written. Existing files are never
 * overwritten (Constitution 10); writes use the `wx` flag so a file created
 * between the check and the write fails loudly instead of being clobbered.
 */
export async function scaffoldWorkspace(
  options: ScaffoldOptions,
): Promise<ScaffoldResult> {
  const { targetRoot, vars } = options;
  const dryRun = options.dryRun ?? false;

  await ensureTargetRoot(targetRoot);

  const plan = buildInitPlan();

  // Phase 2: inspect every planned path before touching anything.
  const states = new Map<string, 'file' | 'dir' | 'other' | 'missing'>();
  const conflicts: Conflict[] = [];

  for (const entry of plan) {
    const absolute = path.join(targetRoot, entry.relativePath);
    const found = await inspect(absolute);
    states.set(entry.relativePath, found);
    if (found !== 'missing' && found !== entry.kind) {
      conflicts.push({
        relativePath: entry.relativePath,
        expected: entry.kind,
        found,
      });
    }
  }

  if (conflicts.length > 0) {
    return { targetRoot, entries: [], conflicts, dryRun };
  }

  // Phase 3: write only what is missing.
  const entries: AppliedEntry[] = [];

  for (const entry of plan) {
    const absolute = path.join(targetRoot, entry.relativePath);
    const found = states.get(entry.relativePath);

    if (found !== 'missing') {
      entries.push({ relativePath: entry.relativePath, kind: entry.kind, action: 'skipped' });
      continue;
    }

    if (!dryRun) {
      if (entry.kind === 'dir') {
        try {
          await mkdir(absolute, { recursive: true });
        } catch (cause) {
          throw new CliError(
            `Could not create directory ${entry.relativePath}: ${describeCause(cause)}`,
          );
        }
      } else {
        const contents = await loadTemplate(entry.template, vars);
        try {
          await writeFile(absolute, contents, { encoding: 'utf8', flag: 'wx' });
        } catch (cause) {
          throw new CliError(
            `Could not write ${entry.relativePath}: ${describeCause(cause)}`,
          );
        }
      }
    }

    entries.push({ relativePath: entry.relativePath, kind: entry.kind, action: 'created' });
  }

  return { targetRoot, entries, conflicts, dryRun };
}
