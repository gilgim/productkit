import { describe, expect, it } from 'vitest';
import { appendFindingConfirmation, createFinding, findingFingerprint, findingInputSchema, parseFinding } from '../src/schema/finding.js';

const base = {
  issue_key: 'payment-timeout-order-state',
  type: 'flow_gap' as const,
  severity: 'major' as const,
  statement: 'Timeout handling after payment is unspecified.',
  related_refs: [{ kind: 'node' as const, ref: 'NOD-001-1' }],
  evidence_refs: [{ kind: 'prompt' as const, ref: 'PRM-001', detail: 'Payment step' }],
  counterexamples: [{ condition: 'payment provider times out', expected: 'documented outcome', observed: 'unspecified', status: 'hypothesis' as const }],
  ai_assessment: { is_ai_judgment: true as const, rationale: 'No timeout outcome is stated.', confidence: 'medium' as const, uncertainty: ['A separate policy may define this elsewhere.'] },
  questions: ['What should happen after a payment timeout?'],
};

describe('Finding model', () => {
  it('creates an immutable AI proposal as proposed and unresolved with hash-bound history', () => {
    const finding = createFinding(base, new Date('2026-10-13T00:00:00.000Z'));
    expect(finding.id).toMatch(/^FND-[0-9a-f]{16}$/);
    expect(finding.review_status).toBe('proposed');
    expect(finding.resolution_status).toBe('unresolved');
    expect(finding.history).toHaveLength(1);
    expect(parseFinding(JSON.stringify(finding))).toEqual(finding);
  });

  it('deduplicates exact content and fingerprints changed claims separately', () => {
    expect(findingFingerprint(base)).toBe(findingFingerprint({ ...base }));
    expect(findingFingerprint({ ...base, statement: 'A different timeout behavior is unspecified.' })).not.toBe(findingFingerprint(base));
  });

  it('rejects agent attempts to set review or resolution state on input', () => {
    expect(findingInputSchema.safeParse({ ...base, review_status: 'confirmed', resolution_status: 'resolved' }).success).toBe(false);
  });

  it('requires explicit user statement and keeps confirmation separate from resolution', () => {
    const finding = createFinding(base);
    expect(() => appendFindingConfirmation(finding, 'confirmed', '', 'I checked it')).toThrow();
    const confirmed = appendFindingConfirmation(finding, 'confirmed', 'This flow is missing.', 'I reviewed the linked requirement.');
    expect(confirmed.review_status).toBe('confirmed');
    expect(confirmed.resolution_status).toBe('unresolved');
    expect(confirmed.history).toHaveLength(2);
    expect(parseFinding(JSON.stringify(confirmed))).toEqual(confirmed);
  });

  it('rejects tampered user confirmation history', () => {
    const confirmed = appendFindingConfirmation(createFinding(base), 'rejected', 'This is not an issue.', 'The retry policy is documented elsewhere.');
    expect(() => parseFinding(JSON.stringify({ ...confirmed, confirmation_history: confirmed.confirmation_history.map((c) => ({ ...c, user_statement: 'tampered' })) }))).toThrow();
  });
});
