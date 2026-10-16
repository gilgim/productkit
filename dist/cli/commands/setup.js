import { lstat, mkdir, readlink, realpath, stat, symlink, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CliError, ExitCode, describeCause } from '../../errors.js';
import { SKILLS_ROOT } from '../../clarification/skills.js';
/**
 * Links the single entry Skill into each Agent's user-level Skill folder so an
 * Agent knows ProductKit exists before anyone types a ProductKit command.
 *
 * This never touches the target app (init still writes only product/). It
 * writes one symlink per Agent and refuses to replace anything it did not
 * create: a real directory or file is always left alone, and a symlink that
 * points elsewhere is replaced only with --force (Constitution 10).
 */
export const ENTRY_SKILL = 'productkit';
export const AGENTS = ['claude', 'codex'];
export function agentConfigDir(agent, env, home) {
    if (agent === 'claude')
        return env.CLAUDE_CONFIG_DIR || path.join(home, '.claude');
    return env.CODEX_HOME || path.join(home, '.codex');
}
async function isDirectory(target) {
    try {
        return (await stat(target)).isDirectory();
    }
    catch {
        return false;
    }
}
async function samePath(a, b) {
    if (path.resolve(a) === path.resolve(b))
        return true;
    try {
        return (await realpath(a)) === (await realpath(b));
    }
    catch {
        return false;
    }
}
async function setupOne(agent, explicit, options, source) {
    const env = options.env ?? process.env;
    const home = options.home ?? os.homedir();
    const dryRun = options.dryRun ?? false;
    const configDir = agentConfigDir(agent, env, home);
    const linkPath = path.join(configDir, 'skills', ENTRY_SKILL);
    const entry = (action, detail) => ({
        agent, linkPath, source, action, dryRun, ...(detail === undefined ? {} : { detail }),
    });
    // "all" only reaches Agents the user already has. Naming an Agent
    // explicitly is consent to create its folder.
    if (!explicit && !(await isDirectory(configDir)))
        return entry('skipped_no_config', `${configDir} not found`);
    let existing;
    try {
        existing = await lstat(linkPath);
    }
    catch (cause) {
        if (cause.code !== 'ENOENT')
            return entry('error', describeCause(cause));
    }
    try {
        if (existing === undefined) {
            if (options.remove)
                return entry('not_linked');
            if (!dryRun) {
                await mkdir(path.dirname(linkPath), { recursive: true });
                await symlink(source, linkPath, 'dir');
            }
            return entry('linked');
        }
        if (!existing.isSymbolicLink()) {
            return entry('conflict', 'a real directory or file is already there; ProductKit never removes it');
        }
        const current = path.resolve(path.dirname(linkPath), await readlink(linkPath));
        const ours = await samePath(current, source);
        if (options.remove) {
            if (!ours)
                return entry('conflict', `points to ${current}, not this installation; left in place`);
            if (!dryRun)
                await unlink(linkPath);
            return entry('removed');
        }
        if (ours)
            return entry('already_linked');
        if (!options.force)
            return entry('conflict', `points to ${current}; rerun with --force to replace the symlink`);
        if (!dryRun) {
            await unlink(linkPath);
            await symlink(source, linkPath, 'dir');
        }
        return entry('replaced', `was ${current}`);
    }
    catch (cause) {
        return entry('error', describeCause(cause));
    }
}
export async function setupAgents(options = {}) {
    const source = options.source ?? path.join(SKILLS_ROOT, ENTRY_SKILL);
    const selected = options.agent ?? 'all';
    const agents = selected === 'all' ? AGENTS : [selected];
    const results = [];
    for (const agent of agents)
        results.push(await setupOne(agent, selected !== 'all', options, source));
    return results;
}
const LABEL = {
    linked: ['linked', 'would link'],
    already_linked: ['already linked', 'already linked'],
    replaced: ['replaced', 'would replace'],
    removed: ['removed', 'would remove'],
    not_linked: ['not linked', 'not linked'],
    skipped_no_config: ['skipped', 'skipped'],
    conflict: ['conflict', 'conflict'],
    error: ['error', 'error'],
};
export function formatSetupEntry(entry) {
    const label = LABEL[entry.action][entry.dryRun ? 1 : 0];
    const agent = entry.agent === 'claude' ? 'Claude Code' : 'Codex';
    const target = entry.action === 'linked' || entry.action === 'replaced' || entry.action === 'already_linked'
        ? `${entry.linkPath} -> ${entry.source}`
        : entry.linkPath;
    return `${agent.padEnd(11)} ${label.padEnd(14)} ${target}${entry.detail ? ` (${entry.detail})` : ''}`;
}
export async function runSetup(options, output) {
    const entries = await setupAgents(options);
    for (const entry of entries)
        output.out(formatSetupEntry(entry));
    if (entries.every((e) => e.action === 'skipped_no_config')) {
        output.out('No Claude Code or Codex config folder found. Run "productkit setup --agent claude" or "--agent codex" to create one.');
    }
    if (!options.remove && entries.some((e) => e.action === 'linked' || e.action === 'replaced') && !options.dryRun) {
        output.out('Start a new Agent session so it picks up the productkit Skill.');
    }
    const errors = entries.filter((e) => e.action === 'error');
    if (errors.length > 0)
        throw new CliError('Some Skill links could not be written.', ExitCode.USAGE_OR_IO);
    const conflicts = entries.filter((e) => e.action === 'conflict');
    if (conflicts.length > 0)
        throw new CliError('Some Skill links were left unchanged because something else is already there.', ExitCode.GATE_BLOCKED);
}
export function registerSetupCommand(program, output) {
    program
        .command('setup')
        .description('link the productkit entry Skill into Claude Code / Codex user Skill folders')
        .option('--agent <agent>', 'claude, codex or all (all = only Agents whose config folder exists)', 'all')
        .option('--remove', 'remove the link this installation created')
        .option('--dry-run', 'report what would change without writing')
        .option('--force', 'replace a productkit symlink that points elsewhere (never a real directory)')
        .action(async (opts) => {
        if (opts.agent !== 'all' && !AGENTS.includes(opts.agent)) {
            throw new CliError(`Unknown agent "${opts.agent}". Use claude, codex or all.`, ExitCode.USAGE_OR_IO);
        }
        await runSetup({ agent: opts.agent, remove: opts.remove, dryRun: opts.dryRun, force: opts.force }, output);
    });
}
//# sourceMappingURL=setup.js.map