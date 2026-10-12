import { describe, expect, it } from 'vitest';
import { computeImpactReport, validateGraph, validateConfirmation, effectiveEdge } from '../src/clarification/graph.js';
import { graphEdgeSchema, type GraphEdge } from '../src/schema/graph.js';
import { createRelationCandidate } from '../src/schema/graph.js';
import type { GraphNodeRecord, GraphWorkspaceSnapshot } from '../src/clarification/provenance.js';
import { atomicNodeFixture } from './helpers/gate-fixtures.js';

function record(id: string, kind: 'requirement' | 'policy' = 'requirement'): GraphNodeRecord {
  return {
    node: { ...atomicNodeFixture(), id, kind }, node_group_ref: `NDG-${id.slice(4, 7)}`, node_group_hash: `${id[4] ?? 'a'}`.repeat(64),
    clarification_ref: `CLR-${id.slice(4, 7)}`, clarification_hash: 'b'.repeat(64), prompt_ref: `PRM-${id.slice(4, 7)}`,
    prompt_hash: 'c'.repeat(64), prompt_spans_hash: 'd'.repeat(64),
  };
}

function snapshot(records: GraphNodeRecord[]): GraphWorkspaceSnapshot {
  const nodes = new Map(records.map((r) => [r.node.id, r]));
  return { schema_version: 1, prompts: new Map(), nodes, node_snapshot_hashes: new Map(records.map((r) => [r.node.id, 'e'.repeat(64)])), issues: [], fingerprint: 'f'.repeat(64) };
}

function edge(id: string, type: GraphEdge['type'], source: string, target: string): GraphEdge {
  return graphEdgeSchema.parse({ id, type, source, target, basis: 'ai_inferred', reason: `${type} 근거`, status: 'proposed', confirmations: [] });
}

describe('Graph confirmation and impact traversal', () => {
  it('never treats a stored confirmed status alone as approval', () => {
    const nodes = snapshot([record('NOD-001-1'), record('NOD-002-1')]).nodes;
    const stored = graphEdgeSchema.parse({ ...edge('EDG-001', 'depends_on', 'NOD-002-1', 'NOD-001-1'), status: 'confirmed' });
    expect(effectiveEdge(stored, nodes).status).toBe('proposed');
    expect(validateGraph([stored], nodes).some((issue) => issue.code === 'invalid_confirmation')).toBe(true);
  });

  it('binds explicit confirmation to the edge claim and current endpoints', () => {
    const nodes = snapshot([record('NOD-001-1'), record('NOD-002-1')]).nodes;
    const proposed = edge('EDG-001', 'depends_on', 'NOD-002-1', 'NOD-001-1');
    const confirmation = validateConfirmation(proposed, nodes, 'agreed', 'SYNTHETIC TEST ONLY', 'SYNTHETIC rationale', '2026-10-13T00:00:00Z');
    const confirmed = graphEdgeSchema.parse({ ...proposed, status: 'confirmed', confirmations: [confirmation] });
    expect(effectiveEdge(confirmed, nodes).status).toBe('confirmed');
    const changedNodes = new Map(nodes);
    changedNodes.set('NOD-001-1', { ...nodes.get('NOD-001-1')!, node: { ...nodes.get('NOD-001-1')!.node, statement: 'changed statement' } });
    expect(effectiveEdge(confirmed, changedNodes).status).toBe('proposed');
    expect(effectiveEdge(confirmed, changedNodes).freshness).toBe('stale');
  });

  it('propagates depends_on in the target-to-source direction only', () => {
    const nodes = snapshot([record('NOD-001-1'), record('NOD-002-1')]);
    const graphEdges = [edge('EDG-001', 'depends_on', 'NOD-002-1', 'NOD-001-1')];
    const report = computeImpactReport({ seedNodeId: 'NOD-002-1', graphEdges, candidates: [], workspace: nodes, createdAt: '2026-10-13T00:00:00Z' });
    expect(report.confirmed_impacts).toHaveLength(0);
    expect(report.potential_impacts).toHaveLength(0);
    const reverse = computeImpactReport({ seedNodeId: 'NOD-001-1', graphEdges, candidates: [], workspace: nodes, createdAt: '2026-10-13T00:00:00Z' });
    expect(reverse.potential_impacts.map((item) => item.node_ref)).toEqual(['NOD-002-1']);
  });

  it('keeps confirmed and potential paths separate and makes conflict terminal review', () => {
    const nodes = snapshot([record('NOD-001-1'), record('NOD-002-1'), record('NOD-003-1'), record('NOD-004-1'), record('NOD-005-1')]);
    const confirmed = (base: GraphEdge) => graphEdgeSchema.parse({ ...base, status: 'confirmed', confirmations: [validateConfirmation(base, nodes.nodes, 'agreed', 'SYNTHETIC TEST ONLY', 'SYNTHETIC rationale', '2026-10-13T00:00:00Z')] });
    const graphEdges = [
      confirmed(edge('EDG-001', 'depends_on', 'NOD-002-1', 'NOD-001-1')),
      confirmed(edge('EDG-002', 'depends_on', 'NOD-003-1', 'NOD-002-1')),
      edge('EDG-003', 'conflicts_with', 'NOD-004-1', 'NOD-002-1'),
      confirmed(edge('EDG-004', 'depends_on', 'NOD-005-1', 'NOD-004-1')),
    ];
    const report = computeImpactReport({ seedNodeId: 'NOD-001-1', graphEdges, candidates: [], workspace: nodes, createdAt: '2026-10-13T00:00:00Z' });
    expect(report.confirmed_impacts.map((item) => item.node_ref)).toEqual(['NOD-002-1', 'NOD-003-1']);
    expect(report.review_candidates.potential.map((item) => item.node_ref)).toEqual(['NOD-004-1']);
    expect(report.confirmed_impacts.map((item) => item.node_ref)).not.toContain('NOD-005-1');
  });

  it('blocks same-type confirmed cycles but permits symmetric cycles', () => {
    const a = record('NOD-001-1'); const b = record('NOD-002-1');
    const nodes = snapshot([a, b]).nodes;
    const first = edge('EDG-001', 'depends_on', b.node.id, a.node.id);
    const second = edge('EDG-002', 'depends_on', a.node.id, b.node.id);
    const confirm = (e: GraphEdge) => graphEdgeSchema.parse({ ...e, status: 'confirmed', confirmations: [validateConfirmation(e, nodes, 'agreed', 'SYNTHETIC TEST ONLY', 'reason', '2026-10-13T00:00:00Z')] });
    expect(validateGraph([confirm(first), confirm(second)], nodes).some((issue) => issue.code === 'confirmed_cycle')).toBe(true);
    const triangle = [
      edge('EDG-003', 'conflicts_with', 'NOD-001-1', 'NOD-002-1'),
    ];
    expect(validateGraph(triangle, nodes).some((issue) => issue.code === 'confirmed_cycle')).toBe(false);
  });

  it('keeps unsupported candidates in blocked_inputs without treating them as impacts', () => {
    const nodes = snapshot([record('NOD-001-1'), record('NOD-002-1')]);
    const candidate = createRelationCandidate({
      original_relation_name: 'causes', source_node_ref: 'NOD-002-1', target_node_ref: 'NOD-001-1',
      proposed_meaning: 'A causes B', evidence_refs: [{ kind: 'node', ref: 'NOD-002-1' }],
      endpoint_snapshot_hashes: { source: 'e'.repeat(64), target: 'e'.repeat(64) }, created_at: '2026-10-13T00:00:00Z',
    });
    const report = computeImpactReport({ seedNodeId: 'NOD-001-1', graphEdges: [], candidates: [candidate], workspace: nodes, createdAt: '2026-10-13T00:00:00Z' });
    expect(report.completeness).toBe('incomplete');
    expect(report.blocked_inputs.some((item) => item.candidate_ref === candidate.id && item.reason.includes('not a supported Edge type'))).toBe(true);
    expect(report.confirmed_impacts).toHaveLength(0);
    expect(report.potential_impacts).toHaveLength(0);
  });

  it('marks wrong-kind edges incomplete and never traverses them', () => {
    const source = { ...record('NOD-002-1'), node: { ...record('NOD-002-1').node, kind: 'fact' as const } };
    const nodes = snapshot([record('NOD-001-1'), source]);
    const invalid = edge('EDG-099', 'depends_on', 'NOD-002-1', 'NOD-001-1');
    const report = computeImpactReport({ seedNodeId: 'NOD-001-1', graphEdges: [invalid], candidates: [], workspace: nodes, createdAt: '2026-10-13T00:00:00Z' });
    expect(report.completeness).toBe('incomplete');
    expect(report.blocked_inputs.some((item) => item.code === 'invalid_kind_pair')).toBe(true);
    expect(report.potential_impacts).toHaveLength(0);
  });
});
