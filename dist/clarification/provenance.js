import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { canonicalJson, sha256Hex } from './hash.js';
import { judgeCompletion, parseClarification, clarificationContentHash } from '../schema/clarification.js';
import { judgeNodeSetCompletion, parseNodeGroup } from '../schema/node.js';
import { parsePrompt, promptIntegrityIssue } from '../schema/prompt.js';
import { parseProductConfig } from '../schema/config.js';
async function yamlFiles(directory) {
    try {
        return (await readdir(directory)).filter((name) => name.endsWith('.yaml')).sort();
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return [];
        throw error;
    }
}
async function readYaml(directory, file) {
    const text = await readFile(path.join(directory, file), 'utf8');
    return { text, value: parseYaml(text) };
}
export function graphNodeSnapshotHash(record) {
    return sha256Hex(canonicalJson(record));
}
export async function loadGraphWorkspace(productRoot) {
    const config = parseProductConfig(await readFile(path.join(productRoot, 'config.yaml'), 'utf8'));
    const prompts = new Map();
    const nodes = new Map();
    const issues = [];
    const promptDir = path.join(productRoot, 'sources');
    const clarificationDir = path.join(productRoot, 'discovery');
    const nodesDir = path.join(productRoot, 'nodes');
    const processedGroups = new Set();
    for (const file of await yamlFiles(promptDir)) {
        try {
            const { text } = await readYaml(promptDir, file);
            const prompt = parsePrompt(text);
            if (path.basename(file, '.yaml') !== prompt.id || promptIntegrityIssue(prompt))
                throw new Error(promptIntegrityIssue(prompt) ?? 'Prompt ID does not match its file.');
            prompts.set(prompt.id, prompt);
        }
        catch (error) {
            issues.push({ code: 'invalid_prompt', ref: file, reason: String(error) });
        }
    }
    for (const file of await yamlFiles(clarificationDir)) {
        try {
            const { text } = await readYaml(clarificationDir, file);
            const clarification = parseClarification(text);
            if (path.basename(file, '.yaml') !== clarification.id)
                throw new Error('Clarification ID does not match its file.');
            const prompt = prompts.get(clarification.prompt_ref);
            if (!prompt) {
                issues.push({ code: 'missing_prompt', ref: clarification.id, reason: `Prompt ${clarification.prompt_ref} does not resolve.` });
                continue;
            }
            const judgement = judgeCompletion(clarification, prompt);
            if (!judgement.confirmed) {
                issues.push({ code: 'unconfirmed_clarification', ref: clarification.id, reason: judgement.reason });
                continue;
            }
            const groupId = `NDG-${clarification.id.slice(4)}`;
            let groupText;
            try {
                groupText = await readFile(path.join(nodesDir, `${groupId}.yaml`), 'utf8');
            }
            catch {
                issues.push({ code: 'missing_node_group', ref: clarification.id, reason: `NodeGroup ${groupId} does not exist.` });
                continue;
            }
            const group = parseNodeGroup(groupText);
            processedGroups.add(`${groupId}.yaml`);
            if (group.id !== groupId || group.clarification_ref !== clarification.id)
                throw new Error('NodeGroup identity/reference mismatch.');
            const groupJudgement = judgeNodeSetCompletion(group, clarification.steps, { clarification, prompt });
            if (groupJudgement.status !== 'modeled') {
                issues.push({ code: 'unmodeled_node_group', ref: groupId, reason: groupJudgement.reasons.join(', ') });
                continue;
            }
            const groupHash = sha256Hex(canonicalJson(group));
            const clrHash = clarificationContentHash(clarification);
            const promptHash = sha256Hex(canonicalJson({ id: prompt.id, content_hash: prompt.content_hash, raw_text: prompt.raw_text, spans: prompt.spans }));
            const spansHash = sha256Hex(canonicalJson(prompt.spans));
            for (const node of group.nodes) {
                if (nodes.has(node.id)) {
                    issues.push({ code: 'duplicate_node_id', ref: node.id, reason: 'Node IDs must be globally unique.' });
                    continue;
                }
                nodes.set(node.id, { node, node_group_ref: group.id, node_group_hash: groupHash, clarification_ref: clarification.id, clarification_hash: clrHash, prompt_ref: prompt.id, prompt_hash: promptHash, prompt_spans_hash: spansHash });
            }
        }
        catch (error) {
            issues.push({ code: 'invalid_clarification_or_group', ref: file, reason: String(error) });
        }
    }
    // A Prompt that was taken in but never clarified is the largest possible
    // omission: none of its content enters the pipeline (Constitution 11).
    const clarified = new Set();
    for (const file of await yamlFiles(clarificationDir)) {
        try {
            const ref = parseClarification((await readYaml(clarificationDir, file)).text).prompt_ref;
            // Two Clarifications of one Prompt would let the fuller one be ignored.
            if (clarified.has(ref))
                issues.push({ code: 'duplicate_clarification', ref: file, reason: `Prompt ${ref} already has a Clarification; only one is allowed.` });
            clarified.add(ref);
        }
        catch { /* reported above */ }
    }
    for (const id of prompts.keys()) {
        if (!clarified.has(id))
            issues.push({ code: 'missing_clarification', ref: id, reason: `Prompt ${id} has no Clarification; run productkit clarify --prompt ${id}.` });
    }
    for (const file of await yamlFiles(nodesDir)) {
        if (/^NDG-\d{3,}\.yaml$/.test(file) && !processedGroups.has(file)) {
            issues.push({ code: 'orphan_node_group', ref: file, reason: 'NodeGroup has no current confirmed Clarification source.' });
        }
    }
    const node_snapshot_hashes = new Map([...nodes].map(([id, record]) => [id, graphNodeSnapshotHash(record)]));
    const fingerprint = sha256Hex(canonicalJson({
        schema_version: config.schema_version,
        prompts: [...prompts].sort(([a], [b]) => a.localeCompare(b)),
        nodes: [...node_snapshot_hashes].sort(([a], [b]) => a.localeCompare(b)),
    }));
    return { schema_version: config.schema_version, prompts, nodes, node_snapshot_hashes, issues, fingerprint };
}
//# sourceMappingURL=provenance.js.map