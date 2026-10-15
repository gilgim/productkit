import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { runInit } from '../src/cli/commands/init.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { promptFixture, confirmedFixture, groupFixture, twoNodeFixtures } from './helpers/gate-fixtures.js';

let root = '';
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });

function builtCli(args: string[]) {
  const binary = path.resolve('dist/cli/bin.js');
  return spawnSync(process.execPath, [binary, ...args], { cwd: root, encoding: 'utf8' });
}

describe('built CLI Graph E2E', () => {
  it('stores an unsupported relation candidate and surfaces it in an incomplete impact report', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'productkit-built-graph-e2e-'));
    await runInit({ cwd: root, now: new Date('2026-10-13T00:00:00Z') }, createMemoryOutput());
    const product = path.join(root, 'product');
    const { prompt, clarification, group } = twoNodeFixtures();
    await writeFile(path.join(product, 'sources', `${prompt.id}.yaml`), stringify(prompt));
    await writeFile(path.join(product, 'discovery', `${clarification.id}.yaml`), stringify(clarification));
    await writeFile(path.join(product, 'nodes', `${group.id}.yaml`), stringify(group));
    await writeFile(path.join(root, 'candidate.yaml'), stringify({
      original_relation_name: 'causes', source_node_ref: 'NOD-001-2', target_node_ref: 'NOD-001-1',
      proposed_meaning: 'The first Node causes the second.', evidence_refs: [{ kind: 'node', ref: 'NOD-001-2' }],
    }));

    const added = builtCli(['graph', 'candidate', 'add', '--input', 'candidate.yaml']);
    expect(added.status).toBe(0);
    expect(added.stdout).toContain('RelationCandidate saved');
    const files = await import('node:fs/promises').then(({ readdir }) => readdir(path.join(product, 'graph', 'candidates')));
    expect(files).toHaveLength(1);
    const impact = builtCli(['graph', 'impact', '--node', 'NOD-001-1']);
    expect(impact.status).toBe(1);
    expect(impact.stdout).toContain('candidate_ref');
    expect(impact.stdout).toContain('incomplete');
    expect(await readFile(path.join(product, 'graph', 'candidates', files[0]!), 'utf8')).toContain('causes');
    const saved = builtCli(['graph', 'impact', '--node', 'NOD-001-1', '--output', 'product/graph/report.yaml']);
    expect(saved.status).toBe(1);
    const reportPath = path.join(product, 'graph', 'report.yaml');
    const report = await readFile(reportPath, 'utf8');
    await writeFile(reportPath, report.replace('causes is not a supported Edge type', 'causes text was altered'));
    const checked = builtCli(['graph', 'impact', '--node', 'NOD-001-1', '--check-report', 'product/graph/report.yaml']);
    expect(checked.status).toBe(1);
    expect(checked.stderr).toContain('STALE or modified');
  });

  it('runs the explicit v0-to-v1 migration command from the built binary', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'productkit-built-migrate-e2e-'));
    await runInit({ cwd: root, now: new Date('2026-10-13T00:00:00Z') }, createMemoryOutput());
    const configPath = path.join(root, 'product', 'config.yaml');
    const config = (await readFile(configPath, 'utf8')).replace('schema_version: 1', 'schema_version: 0')
      .replace(/  atomic_modeling: not_started\n/, '').replace(/  graph_analysis: not_started\n/, '');
    await writeFile(configPath, config);
    const result = builtCli(['migrate']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Migration: committed');
    expect(await readFile(configPath, 'utf8')).toContain('schema_version: 1');
    expect(await readFile(path.join(productBackupDir(root), 'config.yaml.v0.bak'), 'utf8')).toContain('schema_version: 0');
  });
});

function productBackupDir(workspace: string): string { return path.join(workspace, 'product'); }
