import { validSteps, promptFixture, preservedCheck } from './helpers/gate-fixtures.js';
import { clarificationContentHash, parseClarification } from '../src/schema/clarification.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';

import { atomicWriteFile } from '../src/clarification/io.js';
import { runInit } from '../src/cli/commands/init.js';
import { runIntake } from '../src/cli/commands/intake.js';
import { runModel } from '../src/cli/commands/model.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { CliError, ExitCode } from '../src/errors.js';
import {
  type Clarification,
  type ClarificationSteps,
  computeEntryHash,
  stepsContentHash,
} from '../src/schema/clarification.js';
import { type Atomicity, type Node, type NodeGroup, evaluateAtomicityFinal, nodeSetContentHash } from '../src/schema/node.js';

let root: string;

const steps: ClarificationSteps = validSteps([
  '결제가 완료되면 주문을 확정한다',
  '결제가 완료되면 확인 이메일을 보낸다',
  '결제가 완료되면 재고를 차감한다',
]);
const originalPrompt = promptFixture('결제가 완료되면 주문을 확정하고, 확인 이메일을 보내고, 재고를 차감한다');

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'productkit-model-'));
  await runInit({ cwd: root, now: new Date('2026-10-12T00:00:00Z') }, createMemoryOutput());
  await runIntake(
    { cwd: root, now: new Date('2026-10-12T00:00:00Z'), text: '결제가 완료되면 주문을 확정하고, 확인 이메일을 보내고, 재고를 차감한다' },
    createMemoryOutput(),
  );
});

afterEach(async () => {
  await chmod(path.join(root, 'product', 'nodes'), 0o755).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
});

function confirmedEntry(forSteps: ClarificationSteps) {
  const base = {
    id: 'IC-001',
    presented_statement: '결제 완료 시 주문 확정, 이메일 발송, 재고 차감이 모두 일어난다',
    presented_hash: stepsContentHash(forSteps),
    prompt_ref: originalPrompt.id,
    prompt_content_hash: originalPrompt.content_hash,
    user_response: 'agreed' as const,
    user_statement: '네 맞습니다',
    checked_at: '2026-10-12T00:00:00Z',
  };
  return { ...base, entry_hash: computeEntryHash(base) };
}

async function writeConfirmedClarification(forSteps: ClarificationSteps = steps): Promise<void> {
  const clarification: Clarification = {
    id: 'CLR-001',
    prompt_ref: 'PRM-001',
    prompt_content_hash: originalPrompt.content_hash,
    steps: forSteps,
    status: 'confirmed',
    interpretation_check: [confirmedEntry(forSteps)],
    finding_candidates: [],
  };
  await writeFile(
    path.join(root, 'product', 'discovery', 'CLR-001.yaml'),
    stringifyYaml(clarification),
    'utf8',
  );
}

function atomicNode(overrides: Partial<Node> & { derived_from: Node['derived_from']; statement: string }): Node {
  const atomicityBase: Omit<Atomicity, 'final'> = {
    single_verifiable_subject: { verdict: 'yes', reason: '하나의 결과만 담음' },
    decomposability: { verdict: 'not_applicable', reason: '분해 불필요' },
    meaning_preservation: { verdict: 'preserved', confidence: 'high', reason: '트리거 보존됨' },
  };
  const atomicity: Atomicity = { ...atomicityBase, final: evaluateAtomicityFinal(atomicityBase) };
  return {
    id: 'NOD-001-1',
    kind: 'requirement',
    origin: 'source',
    structural_signal: { conjunction_count: 0, multiple_predicates: false },
    atomicity,
    ...overrides,
  };
}

async function writeNodeGroup(group: NodeGroup): Promise<void> {
  const clarification = parseClarification(await readFile(path.join(root, 'product/discovery/CLR-001.yaml'), 'utf8'));
  group = { ...group, clarification_content_hash: clarificationContentHash(clarification),
    distortion_checks: group.distortion_checks.length ? group.distortion_checks : clarification.steps.decomposition.map((d, i) => preservedCheck(i, d.statement)),
  };
  await mkdir(path.join(root, 'product', 'nodes'), { recursive: true });
  await writeFile(
    path.join(root, 'product', 'nodes', `${group.id}.yaml`),
    stringifyYaml(group),
    'utf8',
  );
}

async function model(extra: Record<string, unknown> = {}) {
  const output = createMemoryOutput();
  await runModel({ cwd: root, ...extra }, output);
  return output;
}

describe('productkit atomize — entry flow', () => {
  it('announces the instruction when no NodeGroup exists yet', async () => {
    await writeConfirmedClarification();
    const output = await model();
    const text = output.stdout.join('\n');
    expect(text).toContain('AI action required');
    expect(text).toContain('model/SKILL.md');
    expect(text).toContain('CLR-001');
  });

  it('refuses when there is no Clarification yet', async () => {
    const error = (await model().catch((caught: unknown) => caught)) as CliError;
    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
    expect(error.details.join('\n')).toContain('productkit intake');
  });

  it('refuses when the Clarification is not confirmed yet', async () => {
    const clarification: Clarification = {
      id: 'CLR-001',
      prompt_ref: 'PRM-001',
    prompt_content_hash: originalPrompt.content_hash,
      steps,
      status: 'in_progress',
      interpretation_check: [],
      finding_candidates: [],
    };
    await writeFile(
      path.join(root, 'product', 'discovery', 'CLR-001.yaml'),
      stringifyYaml(clarification),
      'utf8',
    );
    const error = (await model().catch((caught: unknown) => caught)) as CliError;
    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
    expect(error.message).toContain('not confirmed');
  });

  it('[기존 워크스페이스 업그레이드] refuses with an init hint when product/nodes/ predates Change 03', async () => {
    await writeConfirmedClarification();
    await rm(path.join(root, 'product', 'nodes'), { recursive: true, force: true });
    const error = (await model().catch((caught: unknown) => caught)) as CliError;
    expect(error).toBeInstanceOf(CliError);
    expect(error.details.join('\n')).toContain('productkit init');

    // Re-running init only adds the missing directory; nothing else is touched.
    const before = await readFile(path.join(root, 'product', 'config.yaml'), 'utf8');
    await runInit({ cwd: root, now: new Date('2026-10-12T00:00:00Z') }, createMemoryOutput());
    const after = await readFile(path.join(root, 'product', 'config.yaml'), 'utf8');
    expect(after).toBe(before);
    const output = await model();
    expect(output.stdout.join('\n')).toContain('AI action required');
  });
});

describe('productkit atomize — completion judgement', () => {
  it('[독립 행동 3개 분해] a NodeGroup with three action Nodes sharing the trigger is modeled', async () => {
    await writeConfirmedClarification();
    const nodes: Node[] = [0, 1, 2].map((i) =>
      atomicNode({
        id: `NOD-001-${i + 1}`,
        statement: steps.decomposition[i]!.statement,
        derived_from: { clarification_ref: 'CLR-001', decomposition_index: i },
      }),
    );
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(steps),
      nodes,
      coverage: { complete: true, uncovered_decomposition_indices: [] },
      distortion_checks: steps.decomposition.map((d, i) => preservedCheck(i, d.statement)),
      finding_candidates: [],
      status: 'in_progress',
    });

    const output = await model();
    expect(output.stdout.join('\n')).toContain('NodeGroup modeled: NDG-001');
  });

  it('[공유 트리거 누락 감지] a split that drops the shared trigger is recorded as distorted and blocks via a finding', async () => {
    await writeConfirmedClarification();
    const nodes: Node[] = [
      atomicNode({
        id: 'NOD-001-1',
        statement: '주문을 확정한다', // trigger "결제가 완료되면" dropped
        derived_from: { clarification_ref: 'CLR-001', decomposition_index: 0 },
      }),
    ];
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(steps),
      nodes,
      coverage: { complete: false, uncovered_decomposition_indices: [1, 2] },
      distortion_checks: [
        {
          decomposition_index: 0,
          reconstructed_statement: '주문을 확정한다',
          verdict: 'distorted',
          confidence: 'high',
          reason: '공유 트리거 결제가 완료되면 이 빠짐',
        },
      ],
      finding_candidates: [
        {
          id: 'NFC-001',
          node_ref: 'NOD-001-1',
          type: 'distortion',
          statement: '공유 트리거 누락 의심',
          status: 'open',
        },
      ],
      status: 'in_progress',
    });

    const output = await model();
    const text = output.stdout.join('\n');
    expect(text).toContain('not yet complete');
    expect(text).toContain('open risk finding');
  });

  it('[복합 조건 정책 유지] a compound-condition policy stays as a single atomic Node', async () => {
    const lockSteps: ClarificationSteps = {
      ...validSteps(['3회 이상 실패했고 최근 1시간 이내면 계정을 잠근다']),
      decomposition: [
        { statement: '3회 이상 실패했고 최근 1시간 이내면 계정을 잠근다', span_refs: ['SPN-001'] },
      ],
    };
    await writeConfirmedClarification(lockSteps);
    const policyAtomicityBase: Omit<Atomicity, 'final'> = {
      single_verifiable_subject: { verdict: 'no', reason: '조건이 결합된 것처럼 보임' },
      decomposability: { verdict: 'would_orphan_pieces', reason: '조건 하나만 떼면 성립 안 함' },
      meaning_preservation: { verdict: 'preserved', confidence: 'high', reason: '그대로 유지' },
    };
    const node: Node = {
      id: 'NOD-001-1',
      kind: 'policy',
      statement: '3회 이상 실패했고 최근 1시간 이내면 계정을 잠근다',
      origin: 'source',
      derived_from: { clarification_ref: 'CLR-001', decomposition_index: 0 },
      structural_signal: { conjunction_count: 1, multiple_predicates: false },
      atomicity: { ...policyAtomicityBase, final: evaluateAtomicityFinal(policyAtomicityBase) },
    };
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(lockSteps),
      nodes: [node],
      coverage: { complete: true, uncovered_decomposition_indices: [] },
      distortion_checks: [],
      finding_candidates: [],
      status: 'in_progress',
    });

    const output = await model();
    expect(output.stdout.join('\n')).toContain('NodeGroup modeled: NDG-001');
    const raw = await readFile(path.join(root, 'product', 'nodes', 'NDG-001.yaml'), 'utf8');
    expect(raw).toContain('kind: policy');
    expect(raw).not.toMatch(/nodes:\n\s*- id: NOD-001-1[\s\S]*- id: NOD-001-2/);
  });

  it('[AND/OR 의미 변경 감지 후보] an operator_change finding blocks modeled', async () => {
    await writeConfirmedClarification();
    const node = atomicNode({
      derived_from: { clarification_ref: 'CLR-001', decomposition_index: 0 },
      statement: '결제가 완료되거나 주문을 확정한다', // AND -> OR drift vs source
    });
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(steps),
      nodes: [node],
      coverage: { complete: false, uncovered_decomposition_indices: [1, 2] },
      distortion_checks: [],
      finding_candidates: [
        {
          id: 'NFC-001',
          node_ref: node.id,
          type: 'operator_change',
          statement: 'AND가 OR로 바뀐 것으로 보임',
          status: 'open',
        },
      ],
      status: 'in_progress',
    });
    const output = await model();
    expect(output.stdout.join('\n')).toContain('not yet complete');
  });

  it('[새 요구사항 무단 추가 감지 후보] an addition finding blocks modeled', async () => {
    await writeConfirmedClarification();
    const node = atomicNode({
      derived_from: { clarification_ref: 'CLR-001', decomposition_index: 0 },
      statement: steps.decomposition[0]!.statement,
    });
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(steps),
      nodes: [node],
      coverage: { complete: false, uncovered_decomposition_indices: [1, 2] },
      distortion_checks: [],
      finding_candidates: [
        {
          id: 'NFC-001',
          node_ref: node.id,
          type: 'addition',
          statement: '원문에 없는 환불 요구사항이 추가된 것으로 보임',
          status: 'open',
        },
      ],
      status: 'in_progress',
    });
    const output = await model();
    expect(output.stdout.join('\n')).toContain('not yet complete');
  });

  it('[단일 검증 대상 불확실성] an undetermined atomicity.final is reported distinctly, not guessed', async () => {
    await writeConfirmedClarification();
    const uncertainBase: Omit<Atomicity, 'final'> = {
      single_verifiable_subject: { verdict: 'uncertain', reason: '결과가 하나인지 여럿인지 불확실' },
      decomposability: { verdict: 'not_applicable', reason: '-' },
      meaning_preservation: { verdict: 'uncertain', confidence: 'low', reason: '-' },
    };
    const node: Node = {
      id: 'NOD-001-1',
      kind: 'requirement',
      statement: steps.decomposition[0]!.statement,
      origin: 'source',
      derived_from: { clarification_ref: 'CLR-001', decomposition_index: 0 },
      structural_signal: { conjunction_count: 0, multiple_predicates: false },
      atomicity: { ...uncertainBase, final: evaluateAtomicityFinal(uncertainBase) },
    };
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(steps),
      nodes: [node],
      coverage: { complete: false, uncovered_decomposition_indices: [1, 2] },
      distortion_checks: [],
      finding_candidates: [],
      status: 'in_progress',
    });
    const output = await model();
    expect(output.stdout.join('\n')).toContain('atomicity.final');
  });

  it('[미해결 위험의 modeled 전이 차단] full coverage alone is not enough while a risk finding is open', async () => {
    await writeConfirmedClarification();
    const nodes = [0, 1, 2].map((i) =>
      atomicNode({
        id: `NOD-001-${i + 1}`,
        statement: steps.decomposition[i]!.statement,
        derived_from: { clarification_ref: 'CLR-001', decomposition_index: i },
      }),
    );
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(steps),
      nodes,
      coverage: { complete: true, uncovered_decomposition_indices: [] },
      distortion_checks: [],
      finding_candidates: [
        { id: 'NFC-001', node_ref: 'NOD-001-2', type: 'condition_change', statement: '조건 변경 의심', status: 'open' },
      ],
      status: 'in_progress',
    });
    const output = await model();
    expect(output.stdout.join('\n')).toContain('not yet complete');
  });

  it('[Clarification 변경 후 Node 결과 무효화] editing steps after modeling invalidates the NodeGroup', async () => {
    await writeConfirmedClarification();
    const nodes = [0, 1, 2].map((i) =>
      atomicNode({
        id: `NOD-001-${i + 1}`,
        statement: steps.decomposition[i]!.statement,
        derived_from: { clarification_ref: 'CLR-001', decomposition_index: i },
      }),
    );
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(steps),
      nodes,
      coverage: { complete: true, uncovered_decomposition_indices: [] },
      distortion_checks: [],
      finding_candidates: [],
      status: 'modeled', // file claims modeled
    });
    expect((await model()).stdout.join('\n')).toContain('NodeGroup modeled');

    // Now the Clarification's steps change (re-opened and re-decomposed).
    const changedSteps: ClarificationSteps = {
      ...validSteps([...steps.decomposition.map(d => d.statement), '환불도 처리한다']),
      decomposition: [...steps.decomposition, { statement: '환불도 처리한다', span_refs: ['SPN-001'] }],
    };
    await writeConfirmedClarification(changedSteps);

    const output = await model();
    const text = output.stdout.join('\n');
    expect(text).toContain('not yet complete');
    expect(text).toContain('changed after this NodeGroup');
  });

  it('[Node 참조 무결성] an out-of-range derived_from is rejected as a schema/structural error, not silently modeled', async () => {
    await writeConfirmedClarification();
    const badNode = atomicNode({
      derived_from: { clarification_ref: 'CLR-001', decomposition_index: 99 },
      statement: steps.decomposition[0]!.statement,
    });
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(steps),
      nodes: [badNode],
      coverage: { complete: true, uncovered_decomposition_indices: [] },
      distortion_checks: [],
      finding_candidates: [],
      status: 'in_progress',
    });
    const output = await model();
    const text = output.stdout.join('\n');
    expect(text).toContain('not yet complete');
    expect(text).toContain('does not resolve');
  });

  it('[중복 실행] running model twice on an already-modeled NodeGroup reports the same result', async () => {
    await writeConfirmedClarification();
    const nodes = [0, 1, 2].map((i) =>
      atomicNode({
        id: `NOD-001-${i + 1}`,
        statement: steps.decomposition[i]!.statement,
        derived_from: { clarification_ref: 'CLR-001', decomposition_index: i },
      }),
    );
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(steps),
      nodes,
      coverage: { complete: true, uncovered_decomposition_indices: [] },
      distortion_checks: [],
      finding_candidates: [],
      status: 'in_progress',
    });
    const first = await model();
    const second = await model();
    expect(first.stdout.join('\n')).toContain('NodeGroup modeled');
    expect(second.stdout.join('\n')).toContain('NodeGroup modeled');
  });

  it('[중단 후 재개] a partially modeled NodeGroup reports exactly which decomposition items remain', async () => {
    await writeConfirmedClarification();
    const node = atomicNode({
      derived_from: { clarification_ref: 'CLR-001', decomposition_index: 0 },
      statement: steps.decomposition[0]!.statement,
    });
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(steps),
      nodes: [node],
      coverage: { complete: false, uncovered_decomposition_indices: [1, 2] },
      distortion_checks: [],
      finding_candidates: [],
      status: 'in_progress',
    });
    const output = await model();
    const text = output.stdout.join('\n');
    expect(text).toContain('not yet complete');
    expect(text).toMatch(/1, 2/);
  });

  it('[쓰기 실패] `productkit atomize` itself never writes to product/nodes/ (read + judge only)', async () => {
    await writeConfirmedClarification();
    const nodes = [0, 1, 2].map((i) =>
      atomicNode({
        id: `NOD-001-${i + 1}`,
        statement: steps.decomposition[i]!.statement,
        derived_from: { clarification_ref: 'CLR-001', decomposition_index: i },
      }),
    );
    await writeNodeGroup({
      id: 'NDG-001',
      clarification_ref: 'CLR-001',
      source_content_hash: nodeSetContentHash(steps),
      nodes,
      coverage: { complete: true, uncovered_decomposition_indices: [] },
      distortion_checks: [],
      finding_candidates: [],
      status: 'in_progress',
    });
    const before = await readFile(path.join(root, 'product', 'nodes', 'NDG-001.yaml'), 'utf8');

    // Even if product/nodes/ is made read-only, `atomize` still succeeds —
    // it only reads and reports. Only the Agent (via SKILL.md) writes NodeGroup files.
    await chmod(path.join(root, 'product', 'nodes'), 0o500);
    const output = await model();
    await chmod(path.join(root, 'product', 'nodes'), 0o755);

    expect(output.stdout.join('\n')).toContain('NodeGroup modeled');
    const after = await readFile(path.join(root, 'product', 'nodes', 'NDG-001.yaml'), 'utf8');
    expect(after).toBe(before);
  });

  it('[쓰기 실패, 유틸 재사용] atomicWriteFile (Change 02) preserves an existing NodeGroup file when a write fails', async () => {
    const groupPath = path.join(root, 'product', 'nodes', 'NDG-002.yaml');
    const original = stringifyYaml({ id: 'NDG-002', note: 'original' });
    await writeFile(groupPath, original, 'utf8');

    await chmod(path.join(root, 'product', 'nodes'), 0o500);
    const error = await atomicWriteFile(groupPath, stringifyYaml({ id: 'NDG-002', note: 'updated' }), {
      overwrite: true,
    }).catch((caught: unknown) => caught);
    await chmod(path.join(root, 'product', 'nodes'), 0o755);

    expect(error).toBeInstanceOf(CliError);
    expect(await readFile(groupPath, 'utf8')).toBe(original);
  });
});

describe('productkit atomize — CLI does not generate Node content', () => {
  it('model.ts contains no statement-generation logic (only reads, judges, and reports)', async () => {
    const source = await readFile(
      new URL('../src/cli/commands/model.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/statement\s*[:=]\s*['"`]/);
  });
});
