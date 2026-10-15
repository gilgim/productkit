import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { CliError, describeCause } from '../errors.js';

/**
 * Skill root.
 *
 * src/workspace/ and dist/workspace/ both sit two levels below the package
 * root, so this resolves to <package>/skills in development and after an npm
 * install. skills/ ships via the `files` field in package.json.
 */
export const SKILL_ROOT = fileURLToPath(new URL('../../skills/', import.meta.url));

/**
 * The skills a workspace needs, in workflow order.
 *
 * Declared rather than derived from walking skills/: a renamed or half-written
 * skill directory should fail loudly at init time instead of silently
 * shipping a workspace that is missing a step.
 */
export const SKILL_NAMES = [
  'productkit',
  'clarify',
  'model',
  'graph',
  'challenge',
  'propose',
  'define',
  'validate',
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

/**
 * Where each agent looks for project-local skills.
 *
 * Both are written so the same workspace works in Claude Code and Codex
 * without the user running a second install step.
 */
export const AGENT_SKILL_DIRS = ['.claude/skills', '.agents/skills'] as const;

/**
 * Reads a skill file relative to SKILL_ROOT.
 *
 * Skill files are copied verbatim — unlike templates they carry no
 * placeholders, and an agent reading `{{product_name}}` in a skill would be a
 * bug, not a feature.
 */
export async function loadSkillFile(relativePath: string): Promise<string> {
  const absolute = path.join(SKILL_ROOT, relativePath);
  try {
    return await readFile(absolute, 'utf8');
  } catch (cause) {
    throw new CliError(
      `Could not read skill "${relativePath}" at ${absolute}: ${describeCause(cause)}`,
    );
  }
}
