import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { afterEach, describe, it, expect } from 'vitest';
import { computeEntryHash, clarificationContentHash } from '../src/schema/clarification.js';
import { evaluateAtomicityFinal, nodeGroupSchema } from '../src/schema/node.js';
import { confirmedFixture, groupFixture, promptFixture, validSteps, atomicNodeFixture, preservedCheck } from './helpers/gate-fixtures.js';

const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(cwd => rm(cwd, { recursive: true, force: true })));
});

const bin = fileURLToPath(new URL('../dist/cli/bin.js', import.meta.url));
function cli(cwd: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
  return { exit: r.status, stdout: r.stdout, stderr: r.stderr };
}
async function workspace() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'productkit-critical-e2e-')); temporaryRoots.push(cwd);
  expect(cli(cwd, 'init').exit).toBe(0);
  expect(cli(cwd, 'intake', promptFixture().raw_text).exit).toBe(0);
  const clarification = confirmedFixture(); const group = groupFixture();
  const sourcePath = path.join(cwd, 'product/sources/PRM-001.yaml');
  const clrPath = path.join(cwd, 'product/discovery/CLR-001.yaml');
  const groupPath = path.join(cwd, 'product/nodes/NDG-001.yaml');
  await writeFile(clrPath, stringify(clarification)); await writeFile(groupPath, stringify(group));
  return { cwd, clarification, group, sourcePath, clrPath, groupPath };
}

// Real compiled CLI processes; fixture agreements are synthetic, not actual user E2E.
describe('critical gate CLI counterexamples (run npm run build first)', () => {
  it('blocks empty steps despite an agreed record, preserves the artifact', async () => {
    const w = await workspace();
    const empty = confirmedFixture({ definition: [], decomposition: [], elaboration: [], relation_check: [], counterexample: [] });
    await writeFile(w.clrPath, stringify(empty));
    const result = cli(w.cwd, 'clarify');
    expect(result.exit).toBe(0); // Existing clarification progress-report convention.
    expect(result.stdout).toContain('not yet complete');
    expect(cli(w.cwd,'atomize').exit).toBe(2);
    expect(await readFile(w.clrPath, 'utf8')).toBe(stringify(empty));
  });
  it('accepts complete current artifacts without changing original or Nodes', async () => {
    const w = await workspace();
    const before = await Promise.all([w.sourcePath,w.clrPath,w.groupPath].map(p => readFile(p,'utf8')));
    expect(cli(w.cwd,'clarify').stdout).toContain('Clarification confirmed:');
    expect(cli(w.cwd,'atomize').stdout).toContain('NodeGroup modeled:');
    expect(await Promise.all([w.sourcePath,w.clrPath,w.groupPath].map(p => readFile(p,'utf8')))).toEqual(before);
  });
  it('blocks a split-required final Node and accepts preserved lineage after splitting', async () => {
    const w = await workspace();
    const steps = validSteps(['결제가 완료되면 주문을 확정하고 이메일을 보낸다.']);
    // Synthetic existing source, explicitly prepared as an isolated fixture.
    const prompt = promptFixture(steps.decomposition[0]!.statement);
    const clarification = confirmedFixture(steps,prompt);
    await writeFile(w.sourcePath,stringify(prompt)); await writeFile(w.clrPath,stringify(clarification));
    const parent = atomicNodeFixture(steps.decomposition[0]!.statement);
    parent.atomicity.single_verifiable_subject.verdict='no'; parent.atomicity.decomposability.verdict='valid_split'; parent.atomicity.final=evaluateAtomicityFinal(parent.atomicity);
    const group = nodeGroupSchema.parse({ ...groupFixture(steps,[parent]), clarification_content_hash: clarificationContentHash(clarification) });
    await writeFile(w.groupPath,stringify(group));
    const blocked = cli(w.cwd,'atomize');
    expect(blocked.stdout).toContain('still require splitting');
    expect(blocked.stdout).not.toContain('NodeGroup modeled:');
    const originalParent = structuredClone(parent);
    group.retired_nodes=[parent];
    // The agent cannot split a sentence: pieces are refused. The user restates the idea in separate sentences instead.
    group.nodes=['결제가 완료되면 주문을 확정하고','결제가 완료되면 이메일을 보낸다.'].map((s,i)=>({...atomicNodeFixture(s),id:`NOD-001-${i+2}`,split_from:parent.id}));
    group.distortion_checks=[preservedCheck(0,steps.decomposition[0]!.statement)];
    await writeFile(w.groupPath,stringify(group));
    const afterSplit=cli(w.cwd,'atomize').stdout;
    expect(afterSplit).toContain('not yet complete');
    expect(afterSplit).toContain('exactly 1 Node');
    expect(group.retired_nodes[0]).toEqual(originalParent);
    expect(group.retired_nodes[0]!.atomicity.final).toBe('split_required');
  });
  it('blocks a nonexistent actual Prompt even with otherwise valid agreement', async () => {
    const w = await workspace();
    w.clarification.prompt_ref='PRM-999';
    await writeFile(w.clrPath,stringify(w.clarification));
    expect(cli(w.cwd,'clarify').exit).toBe(2);
    const result=cli(w.cwd,'atomize');
    expect(result.exit).toBe(2); expect(result.stderr).toContain('missing_prompt');
  });
  it('invalidates clarification and group after raw Prompt change without overwriting downstream', async () => {
    const w = await workspace(); const changed={...promptFixture(),raw_text:'결제 없이 주문을 확정한다.'};
    await writeFile(w.sourcePath,stringify(changed));
    const before=await Promise.all([w.clrPath,w.groupPath].map(p=>readFile(p,'utf8')));
    expect(cli(w.cwd,'clarify').stdout).toContain('text/hash/spans are inconsistent');
    expect(cli(w.cwd,'atomize').exit).toBe(2);
    expect(await Promise.all([w.clrPath,w.groupPath].map(p=>readFile(p,'utf8')))).toEqual(before);
  });
  it('invalidates the group after Clarification changes even with a new valid agreement', async () => {
    const w = await workspace(); const steps=validSteps(); steps.definition[0]!.meaning='새롭게 확인한 주문 확정의 정의';
    await writeFile(w.clrPath,stringify(confirmedFixture(steps)));
    expect(cli(w.cwd,'clarify').stdout).toContain('Clarification confirmed:');
    expect(cli(w.cwd,'atomize').stdout).toContain('changed');
    expect(cli(w.cwd,'atomize').stdout).not.toContain('NodeGroup modeled:');
  });
  it('invalidates the group when only approval history is replaced', async () => {
    const w=await workspace(); const entry=w.clarification.interpretation_check[0]!;
    const {entry_hash:_hash,...rest}=entry; const next={...rest,id:'IC-TEST-002'};
    w.clarification.interpretation_check.push({...next,entry_hash:computeEntryHash(next)});
    await writeFile(w.clrPath,stringify(w.clarification));
    expect(cli(w.cwd,'clarify').stdout).toContain('Clarification confirmed:');
    expect(cli(w.cwd,'atomize').stdout).not.toContain('NodeGroup modeled:');
  });
  it('preserves readable legacy artifacts and requires re-review instead of auto-filling snapshots', async () => {
    const w=await workspace(); delete w.clarification.prompt_content_hash;
    await writeFile(w.clrPath,stringify(w.clarification));
    expect(cli(w.cwd,'clarify').stdout).toContain('snapshot is missing or changed');
    expect(await readFile(w.clrPath,'utf8')).toBe(stringify(w.clarification));
  });
});
