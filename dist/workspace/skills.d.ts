/**
 * Skill root.
 *
 * src/workspace/ and dist/workspace/ both sit two levels below the package
 * root, so this resolves to <package>/skills in development and after an npm
 * install. skills/ ships via the `files` field in package.json.
 */
export declare const SKILL_ROOT: string;
/**
 * The skills a workspace needs, in workflow order.
 *
 * Declared rather than derived from walking skills/: a renamed or half-written
 * skill directory should fail loudly at init time instead of silently
 * shipping a workspace that is missing a step.
 */
export declare const SKILL_NAMES: readonly ['productkit', 'clarify', 'model', 'graph', 'challenge', 'propose', 'define', 'validate'];
/**
 * Folder and Skill name an agent sees. Prefixed so user-wide skills never
 * collide with built-in commands (/model) or other skills (graph, validate).
 */
export declare function installedSkillName(skill: string): string;
export type SkillName = (typeof SKILL_NAMES)[number];
/**
 * Where each agent looks for project-local skills.
 *
 * Both are written so the same workspace works in Claude Code and Codex
 * without the user running a second install step.
 */
export declare const AGENT_SKILL_DIRS: readonly ['.claude/skills', '.agents/skills'];
/**
 * Reads a skill file relative to SKILL_ROOT.
 *
 * Skill files are copied verbatim — unlike templates they carry no
 * placeholders, and an agent reading `{{product_name}}` in a skill would be a
 * bug, not a feature.
 */
export declare function loadSkillFile(relativePath: string): Promise<string>;
