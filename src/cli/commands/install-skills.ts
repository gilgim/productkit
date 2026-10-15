import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AGENT_SKILL_DIRS, SKILL_NAMES, installedSkillName, loadSkillFile } from '../../workspace/skills.js';
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
export async function runInstallSkills(
  options: InstallSkillsOptions,
  output: Output,
): Promise<void> {
  const home = options.home ?? os.homedir();
  let written = 0;
  let kept = 0;

  for (const agentDir of AGENT_SKILL_DIRS) {
    for (const skill of SKILL_NAMES) {
      const target = path.join(home, agentDir, installedSkillName(skill), 'SKILL.md');
      const content = await loadSkillFile(`${skill}/SKILL.md`);
      const existing = await readFile(target, 'utf8').catch(() => undefined);
      if (existing === content) continue;
      if (existing !== undefined && !options.force) {
        kept += 1;
        continue;
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, 'utf8');
      written += 1;
    }
  }

  output.out(`Skills installed in ~/${AGENT_SKILL_DIRS.join(' and ~/')}: ${written} written, ${kept} kept (differs; use --force to overwrite).`);
  if (written > 0) output.out('Restart Claude Code or Codex so it picks them up.');
}

/** Silent first-run install: only when the entry skill is missing. */
export async function ensureGlobalSkills(home: string = os.homedir()): Promise<void> {
  if (process.env.PRODUCTKIT_SKIP_SKILLS || process.env.VITEST) return;
  try {
    const marker = path.join(home, AGENT_SKILL_DIRS[0], 'productkit', 'SKILL.md');
    if (await readFile(marker, 'utf8').then(() => true, () => false)) return;
    await runInstallSkills({ home }, { out: () => {}, err: () => {} } as unknown as Output);
  } catch {
    // best effort
  }
}
