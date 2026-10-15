import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { runInit } from '../src/cli/commands/init.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { addRelationCandidate, readRelationCandidates } from '../src/clarification/graph-store.js';
import { promptFixture, confirmedFixture, groupFixture, twoNodeFixtures } from './helpers/gate-fixtures.js';

let root = '';
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });

async function workspace() {
  root = await mkdtemp(path.join(tmpdir(), 'productkit-graph-store-'));
  await runInit({ cwd: root, now: new Date('2026-10-13T00:00:00Z') }, createMemoryOutput());
  const product = path.join(root, 'product');
  const { prompt, clarification: clr, group } = twoNodeFixtures();
  await writeFile(path.join(product, 'sources', `${prompt.id}.yaml`), stringify(prompt));
  await writeFile(path.join(product, 'discovery', `${clr.id}.yaml`), stringify(clr));
  await writeFile(path.join(product, 'nodes', `${group.id}.yaml`), stringify(group));
  return product;
}

const input = {
  original_relation_name: 'causes', source_node_ref: 'NOD-001-1', target_node_ref: 'NOD-001-2',
  proposed_meaning: 'A가 B를 일으킬 수 있다', evidence_refs: [{ kind: 'node' as const, ref: 'NOD-001-1' }],
};

describe('file-backed RelationCandidate store', () => {
  it('stores unsupported hypotheses separately and deduplicates identical reruns', async () => {
    const product = await workspace();
    const first = await addRelationCandidate(product, input, new Date('2026-10-13T00:00:00Z'));
    const second = await addRelationCandidate(product, input, new Date('2026-10-13T00:01:00Z'));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(first.candidate.id).toBe(second.candidate.id);
    expect((await readRelationCandidates(product)).map((item) => item.original_relation_name)).toEqual(['causes']);
    await expect(readFile(path.join(product, 'graph', 'edges.yaml'))).rejects.toThrow();
    expect(await readdir(path.join(product, 'graph', 'candidates'))).toEqual([`${first.candidate.id}.yaml`]);
  });

  it('detects changed Node snapshot without deleting the Candidate', async () => {
    const product = await workspace();
    const created = await addRelationCandidate(product, input);
    const nodeFile = path.join(product, 'nodes', 'NDG-001.yaml');
    const beforeCandidate = await readFile(path.join(product, 'graph', 'candidates', `${created.candidate.id}.yaml`), 'utf8');
    const group = (await import('../src/schema/node.js')).parseNodeGroup(await readFile(nodeFile, 'utf8'));
    group.nodes[0]!.statement += ' 변경';
    await writeFile(nodeFile, stringify(group));
    const current = await (await import('../src/clarification/provenance.js')).loadGraphWorkspace(product);
    expect(current.node_snapshot_hashes.get('NOD-001-1')).not.toBe(created.candidate.endpoint_snapshot_hashes.source);
    expect(await readFile(path.join(product, 'graph', 'candidates', `${created.candidate.id}.yaml`), 'utf8')).toBe(beforeCandidate);
  });

  it('does not replace a pre-existing path on candidate file write failure', async () => {
    const product = await workspace();
    const current = await (await import('../src/clarification/provenance.js')).loadGraphWorkspace(product);
    const candidate = (await import('../src/schema/graph.js')).createRelationCandidate({
      ...input,
      endpoint_snapshot_hashes: { source: current.node_snapshot_hashes.get(input.source_node_ref)!, target: current.node_snapshot_hashes.get(input.target_node_ref)! },
      created_at: '2026-10-13T00:00:00Z',
    });
    const target = path.join(product, 'graph', 'candidates', `${candidate.id}.yaml`);
    await mkdir(path.join(product, 'graph', 'candidates'), { recursive: true });
    await mkdir(target);
    await writeFile(path.join(target, 'keep.txt'), 'keep');
    await expect(addRelationCandidate(product, input, new Date('2026-10-13T00:00:00Z'))).rejects.toThrow();
    expect(await readFile(path.join(target, 'keep.txt'), 'utf8')).toBe('keep');
  });
});
