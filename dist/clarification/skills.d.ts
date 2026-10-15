/**
 * Skill instructions ship as plain files (like templates/), not as a native
 * Claude Code skill — `init` never writes outside product/, so there is no
 * ProductKit-managed `.claude/skills/` entry to auto-trigger from. Agents
 * read this path directly; a user who wants Claude Code's native
 * auto-selection can link it into `.claude/skills/` themselves.
 */
export declare const SKILLS_ROOT: string;
