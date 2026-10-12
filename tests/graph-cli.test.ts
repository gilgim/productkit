import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { runInit } from '../src/cli/commands/init.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { runGraphCandidateAdd, runGraphImpact, runGraphEdgeAdd, runGraphEdgeConfirm } from '../src/cli/commands/graph.js';
import { parseGraphDocument } from '../src/schema/graph.js';
import { promptFixture, confirmedFixture, groupFixture } from './helpers/gate-fixtures.js';
import { CliError, ExitCode } from '../src/errors.js';

let root = '';
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });

async function workspace() {
  root = await mkdtemp(path.join(tmpdir(), 'productkit-graph-cli-'));
  await runInit({ cwd: root, now: new Date('2026-10-13T00:00:00Z') }, createMemoryOutput());
  const product = path.join(root, 'product');
  const prompt = promptFixture();
  const clr = confirmedFixture(undefined, prompt);
  const group = groupFixture(clr.steps);
  group.nodes.push({ ...group.nodes[0]!, id: 'NOD-001-2' });
  await writeFile(path.join(product, 'sources', `${prompt.id}.yaml`), stringify(prompt));
  await writeFile(path.join(product, 'discovery', `${clr.id}.yaml`), stringify(clr));
  await writeFile(path.join(product, 'nodes', `${group.id}.yaml`), stringify(group));
  return product;
}

describe('Graph CLI behaviors', () => {
  it('stores unsupported causes as Candidate, dedupes them, and includes them in report blocking', async () => {
    const product = await workspace();
    const inputFile = path.join(root, 'candidate.yaml');
    await writeFile(inputFile, stringify({ original_relation_name: 'causes', source_node_ref: 'NOD-001-2', target_node_ref: 'NOD-001-1', proposed_meaning: 'The first Node causes the second.', evidence_refs: [{ kind: 'node', ref: 'NOD-001-2' }] }));
    const output = createMemoryOutput();
    await runGraphCandidateAdd({ cwd: root, input: inputFile }, output);
    const first = output.stdout.join('\n');
    expect(first).toContain('RelationCandidate saved');
    const repeated = createMemoryOutput();
    await runGraphCandidateAdd({ cwd: root, input: inputFile }, repeated);
    expect(repeated.stdout.join('\n')).toContain('already exists');
    await expect(readFile(path.join(product, 'graph', 'edges.yaml'))).rejects.toThrow();
    const impact = createMemoryOutput();
    await expect(runGraphImpact({ cwd: root, node: 'NOD-001-1' }, impact)).rejects.toMatchObject<CliError>({ exitCode: ExitCode.GATE_BLOCKED });
    expect(impact.stdout.join('\n')).toContain('candidate_ref');
    expect(impact.stdout.join('\n')).toContain('incomplete');
  });

  it('requires proposed AI edges and a separate explicit confirmation record', async () => {
    await workspace();
    const edgeFile = path.join(root, 'edge.yaml');
    const proposed = { id: 'EDG-001', type: 'depends_on', source: 'NOD-001-2', target: 'NOD-001-1', basis: 'ai_inferred', reason: 'The second requirement depends on the first.', status: 'proposed', confirmations: [] };
    await writeFile(edgeFile, stringify({ ...proposed, status: 'confirmed' }));
    await expect(runGraphEdgeAdd({ cwd: root, input: edgeFile }, createMemoryOutput())).rejects.toThrow('must start proposed');
    await writeFile(edgeFile, stringify(proposed));
    await runGraphEdgeAdd({ cwd: root, input: edgeFile }, createMemoryOutput());
    let graph = parseGraphDocument(await readFile(path.join(root, 'product', 'graph', 'edges.yaml'), 'utf8'));
    expect(graph.edges[0]!.status).toBe('proposed');
    expect(graph.edges[0]!.confirmations).toHaveLength(0);
    await runGraphEdgeConfirm({ cwd: root, id: 'EDG-001', response: 'agreed', statement: 'SYNTHETIC TEST ONLY: approved', rationale: 'SYNTHETIC fixture', }, createMemoryOutput());
    graph = parseGraphDocument(await readFile(path.join(root, 'product', 'graph', 'edges.yaml'), 'utf8'));
    expect(graph.edges[0]!.status).toBe('confirmed');
    expect(graph.edges[0]!.confirmations).toHaveLength(1);
  });
});
