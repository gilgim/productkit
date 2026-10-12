import { describe, expect, it } from 'vitest';
import { createRelationCandidate, relationCandidateSchema, relationKindAllowed } from '../src/schema/graph.js';

const hash = 'a'.repeat(64);
const input = {
  original_relation_name: 'causes', source_node_ref: 'NOD-001-1', target_node_ref: 'NOD-002-1',
  proposed_meaning: 'A가 B의 원인일 수 있다', evidence_refs: [{ kind: 'node' as const, ref: 'NOD-001-1' }],
  endpoint_snapshot_hashes: { source: hash, target: 'b'.repeat(64) }, created_at: '2026-10-13T00:00:00Z',
};

describe('Graph relationship contract', () => {
  it('allows only the six v0 Edge relation names and kind combinations', () => {
    expect(relationKindAllowed('depends_on', 'requirement', 'policy')).toBe(true);
    expect(relationKindAllowed('precedes', 'requirement', 'requirement')).toBe(true);
    expect(relationKindAllowed('exception_of', 'policy', 'policy')).toBe(true);
    expect(relationKindAllowed('depends_on', 'fact', 'policy')).toBe(false);
  });

  it('preserves an unsupported relationship as a deterministic pending Candidate', () => {
    const a = createRelationCandidate(input);
    const b = createRelationCandidate({ ...input, evidence_refs: [...input.evidence_refs].reverse() });
    expect(a.id).toBe(b.id);
    expect(a.review_status).toBe('pending');
    expect(a.id).toMatch(/^RLC-[0-9a-f]{16}$/);
    expect(relationCandidateSchema.parse(a).original_relation_name).toBe('causes');
  });

  it('rejects unsupported types as Graph Edges', async () => {
    const { graphEdgeSchema } = await import('../src/schema/graph.js');
    expect(() => graphEdgeSchema.parse({ id: 'EDG-001', type: 'causes', source: input.source_node_ref, target: input.target_node_ref, basis: 'ai_inferred', reason: 'cause', status: 'proposed' })).toThrow();
  });
});
