import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AGENT_SKILL_DIRS, SKILL_NAMES, installedSkillName, loadSkillFile } from '../../workspace/skills.js';
/**
 * Copies every skill into the user-level agent skill folders so Claude Code and
 * Codex see ProductKit in any project, with no per-project `init` first.
 * Existing files are kept unless --force, so local edits survive.
 */
export async function runInstallSkills(options, output) {
    const home = options.home ?? os.homedir();
    await removeLegacySkills(home);
    let written = 0;
    let kept = 0;
    for (const agentDir of AGENT_SKILL_DIRS) {
        for (const skill of SKILL_NAMES) {
            const target = path.join(home, agentDir, installedSkillName(skill), 'SKILL.md');
            const content = await loadSkillFile(`${skill}/SKILL.md`);
            const existing = await readFile(target, 'utf8').catch(() => undefined);
            if (existing === content)
                continue;
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
    if (written > 0)
        output.out('Restart Claude Code or Codex so it picks them up.');
}
/** Silent first-run install: only when the entry skill is missing. */
export async function ensureGlobalSkills(home = os.homedir()) {
    if (process.env.PRODUCTKIT_SKIP_SKILLS || process.env.VITEST)
        return;
    try {
        // Install when missing; overwrite when a shipped skill changed (an upgrade).
        // The productkit-* names are ours, so overwriting them loses nothing of the user's.
        let stale = false;
        for (const skill of SKILL_NAMES) {
            const target = path.join(home, AGENT_SKILL_DIRS[0], installedSkillName(skill), 'SKILL.md');
            const installed = await readFile(target, 'utf8').catch(() => undefined);
            if (installed !== await loadSkillFile(`${skill}/SKILL.md`)) {
                stale = true;
                break;
            }
        }
        if (stale)
            await runInstallSkills({ home, force: true }, { out: () => { }, err: () => { } });
    }
    catch {
        // best effort
    }
}
/**
 * Earlier builds installed unprefixed names (model, graph, ...) that collide
 * with built-in commands. Remove them, but only a folder holding nothing but a
 * ProductKit SKILL.md so a user's own skill of the same name is never touched.
 */
async function removeLegacySkills(home) {
    for (const agentDir of AGENT_SKILL_DIRS) {
        for (const skill of SKILL_NAMES) {
            if (skill === 'productkit')
                continue;
            const dir = path.join(home, agentDir, skill);
            try {
                const files = await readdir(dir);
                if (files.length !== 1 || files[0] !== 'SKILL.md')
                    continue;
                const text = await readFile(path.join(dir, 'SKILL.md'), 'utf8');
                if (new RegExp(`^---\\nname: ${skill}\\n`).test(text) && /productkit/i.test(text)) {
                    await rm(dir, { recursive: true });
                }
            }
            catch {
                // not there
            }
        }
    }
}
//# sourceMappingURL=install-skills.js.map