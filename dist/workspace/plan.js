/**
 * The explicit list of what `productkit init` creates.
 *
 * The plan is declared rather than derived from walking templates/: a stray or
 * renamed template file should fail loudly at render time instead of silently
 * changing the generated workspace.
 */
import { AGENT_SKILL_DIRS, SKILL_NAMES, installedSkillName } from './skills.js';
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
];
function dir(relativePath) {
    return { kind: 'dir', relativePath };
}
function file(relativePath, template) {
    return { kind: 'file', relativePath, source: { from: 'template', path: template } };
}
function skillFile(relativePath, skillPath) {
    return { kind: 'file', relativePath, source: { from: 'skill', path: skillPath } };
}
/**
 * Builds the full create plan. Order matters: a directory is always listed
 * before anything inside it.
 */
export function buildInitPlan(options = {}) {
    const entries = [
        dir(WORKSPACE_DIR),
        file(`${WORKSPACE_DIR}/config.yaml`, 'product/config.yaml'),
        file(`${WORKSPACE_DIR}/constitution.md`, 'product/constitution.md'),
        file(`${WORKSPACE_DIR}/overview.md`, 'product/overview.md'),
    ];
    for (const name of ARTIFACT_DIRS) {
        entries.push(dir(`${WORKSPACE_DIR}/${name}`));
        entries.push(file(`${WORKSPACE_DIR}/${name}/README.md`, `product/${name}/README.md`));
    }
    if (options.skills ?? true) {
        for (const agentDir of AGENT_SKILL_DIRS) {
            // Both path segments are planned so the conflict check sees a file
            // sitting where a directory belongs before anything is written.
            const agentRoot = agentDir.slice(0, agentDir.indexOf('/'));
            entries.push(dir(agentRoot));
            entries.push(dir(agentDir));
            for (const skill of SKILL_NAMES) {
                const installed = installedSkillName(skill);
                entries.push(dir(`${agentDir}/${installed}`));
                entries.push(skillFile(`${agentDir}/${installed}/SKILL.md`, `${skill}/SKILL.md`));
            }
        }
    }
    return entries;
}
//# sourceMappingURL=plan.js.map