import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { canonicalJson, sha256Hex } from './hash.js';
import { judgeCompletion, parseClarification, clarificationContentHash } from '../schema/clarification.js';
import { judgeNodeSetCompletion, parseNodeGroup, type Node } from '../schema/node.js';
import { parsePrompt, promptIntegrityIssue, type Prompt } from '../schema/prompt.js';
import { parseProductConfig } from '../schema/config.js';

export interface GraphNodeRecord {
  node: Node;
  node_group_ref: string;
  node_group_hash: string;
  clarification_ref: string;
  clarification_hash: string;
  prompt_ref: string;
  prompt_hash: string;
  prompt_spans_hash: string;
}

export interface ProvenanceIssue { code: string; ref: string; reason: string }

export interface GraphWorkspaceSnapshot {
  schema_version: 0 | 1;
  prompts: Map<string, Prompt>;
  nodes: Map<string, GraphNodeRecord>;
  node_snapshot_hashes: Map<string, string>;
  issues: ProvenanceIssue[];
  fingerprint: string;
}

async function yamlFiles(directory: string): Promise<string[]> {
  try { return (await readdir(directory)).filter((name) => name.endsWith('.yaml')).sort(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}

async function readYaml(directory: string, file: string): Promise<{ text: string; value: unknown }> {
  const text = await readFile(path.join(directory, file), 'utf8');
  return { text, value: parseYaml(text) };
}

export function graphNodeSnapshotHash(record: GraphNodeRecord): string {
  return sha256Hex(canonicalJson(record));
}

export async function loadGraphWorkspace(productRoot: string): Promise<GraphWorkspaceSnapshot> {
  const config = parseProductConfig(await readFile(path.join(productRoot, 'config.yaml'), 'utf8'));
  const prompts = new Map<string, Prompt>();
  const nodes = new Map<string, GraphNodeRecord>();
  const issues: ProvenanceIssue[] = [];
  const promptDir = path.join(productRoot, 'sources');
  const clarificationDir = path.join(productRoot, 'discovery');
  const nodesDir = path.join(productRoot, 'nodes');
  const processedGroups = new Set<string>();

  for (const file of await yamlFiles(promptDir)) {
    try {
      const { text } = await readYaml(promptDir, file);
      const prompt = parsePrompt(text);
      if (path.basename(file, '.yaml') !== prompt.id || promptIntegrityIssue(prompt)) throw new Error(promptIntegrityIssue(prompt) ?? 'Prompt ID does not match its file.');
      prompts.set(prompt.id, prompt);
    } catch (error) { issues.push({ code: 'invalid_prompt', ref: file, reason: String(error) }); }
  }

  for (const file of await yamlFiles(clarificationDir)) {
    try {
      const { text } = await readYaml(clarificationDir, file);
      const clarification = parseClarification(text);
      if (path.basename(file, '.yaml') !== clarification.id) throw new Error('Clarification ID does not match its file.');
      const prompt = prompts.get(clarification.prompt_ref);
      if (!prompt) { issues.push({ code: 'missing_prompt', ref: clarification.id, reason: `Prompt ${clarification.prompt_ref} does not resolve.` }); continue; }
      const judgement = judgeCompletion(clarification, prompt);
      if (!judgement.confirmed) { issues.push({ code: 'unconfirmed_clarification', ref: clarification.id, reason: judgement.reason }); continue; }
      const groupId = `NDG-${clarification.id.slice(4)}`;
      let groupText: string;
      try { groupText = await readFile(path.join(nodesDir, `${groupId}.yaml`), 'utf8'); }
      catch { issues.push({ code: 'missing_node_group', ref: clarification.id, reason: `NodeGroup ${groupId} does not exist.` }); continue; }
      const group = parseNodeGroup(groupText);
      processedGroups.add(`${groupId}.yaml`);
      if (group.id !== groupId || group.clarification_ref !== clarification.id) throw new Error('NodeGroup identity/reference mismatch.');
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
        if (nodes.has(node.id)) { issues.push({ code: 'duplicate_node_id', ref: node.id, reason: 'Node IDs must be globally unique.' }); continue; }
        nodes.set(node.id, { node, node_group_ref: group.id, node_group_hash: groupHash, clarification_ref: clarification.id, clarification_hash: clrHash, prompt_ref: prompt.id, prompt_hash: promptHash, prompt_spans_hash: spansHash });
      }
    } catch (error) { issues.push({ code: 'invalid_clarification_or_group', ref: file, reason: String(error) }); }
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
