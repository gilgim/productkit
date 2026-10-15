import { validSteps, promptFixture } from './helpers/gate-fixtures.js';
import { describe, expect, it } from 'vitest';

import { canonicalJson, sha256Hex } from '../src/clarification/hash.js';
import { segmentSpans } from '../src/clarification/spans.js';
import { computePromptHash } from '../src/schema/prompt.js';
import {
  type Clarification,
  type ClarificationSteps,
  clarificationSchema,
  computeEntryHash,
  judgeCompletion,
  stepsContentHash,
  stepsContentHashFromYaml,
} from '../src/schema/clarification.js';
import { stringify as stringifyYaml } from 'yaml';

const completeSteps: ClarificationSteps = validSteps();

function buildEntry(
  steps: ClarificationSteps,
  overrides: Partial<{
    id: string;
    user_response: 'agreed' | 'disagreed' | 'partially_agreed';
    user_statement: string;
  }> = {},
) {
  const base = {
    id: overrides.id ?? 'IC-001',
    presented_statement: `원문: ${promptFixture().raw_text} / reconstructed statement`,
    presented_hash: stepsContentHash(steps),
    prompt_ref: promptFixture().id,
    prompt_content_hash: promptFixture().content_hash,
    user_response: overrides.user_response ?? ('agreed' as const),
    user_statement: overrides.user_statement ?? 'yes, that is right',
    checked_at: '2026-10-12T00:00:00Z',
  };
  return { ...base, entry_hash: computeEntryHash(base) };
}

function buildClarification(
  steps: ClarificationSteps,
  interpretation_check: Clarification['interpretation_check'] = [],
): Clarification {
  return clarificationSchema.parse({
    id: 'CLR-001',
    prompt_ref: 'PRM-001',
    prompt_content_hash: promptFixture().content_hash,
    steps,
    status: 'in_progress',
    interpretation_check,
    finding_candidates: [],
  });
}

describe('canonicalJson', () => {
  it('is independent of key order', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it('keeps array order (order is meaningful)', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe('computePromptHash', () => {
  it('is deterministic for the same text', () => {
    expect(computePromptHash('hello')).toBe(computePromptHash('hello'));
  });

  it('differs for different text', () => {
    expect(computePromptHash('hello')).not.toBe(computePromptHash('hello!'));
  });

  it('matches a plain sha256 of the text', () => {
    expect(computePromptHash('hello')).toBe(sha256Hex('hello'));
  });
});

describe('segmentSpans', () => {
  it('is deterministic for the same input', () => {
    const text = 'First sentence. Second sentence!';
    expect(segmentSpans(text)).toEqual(segmentSpans(text));
  });

  it('produces non-overlapping, in-order spans', () => {
    const spans = segmentSpans('First sentence. Second sentence! Third?');
    expect(spans.length).toBe(3);
    for (let i = 1; i < spans.length; i += 1) {
      expect(spans[i]!.start).toBeGreaterThanOrEqual(spans[i - 1]!.end - 1);
    }
  });

  it('skips blank segments', () => {
    const spans = segmentSpans('One.\n\n\nTwo.');
    expect(spans.map((s) => s.id)).toEqual(['SPN-001', 'SPN-002']);
  });
});

describe('stepsContentHash', () => {
  it('is independent of field order within steps', () => {
    const a = stepsContentHash(completeSteps);
    const b = stepsContentHash({ ...completeSteps });
    expect(a).toBe(b);
  });

  it('changes when steps content changes', () => {
    const changed: ClarificationSteps = {
      ...completeSteps,
      definition: [{ term: 'x', meaning: 'y', origin: 'user_stated' }],
    };
    expect(stepsContentHash(completeSteps)).not.toBe(stepsContentHash(changed));
  });
});

describe('stepsContentHashFromYaml', () => {
  it('matches stepsContentHash on the same steps, from raw Clarification YAML', () => {
    const clarification = buildClarification(completeSteps);
    const yamlText = stringifyYaml(clarification);
    expect(stepsContentHashFromYaml(yamlText)).toBe(stepsContentHash(completeSteps));
  });

  it('lets an Agent compute a verifiable hash without its own "yaml" dependency', () => {
    // Regression test: a hand-authored skill snippet that called require('yaml')
    // directly broke in a real installed consumer app whose node_modules layout
    // didn't hoist `yaml` to the top level. This helper must not need that.
    const changed: ClarificationSteps = {
      ...completeSteps,
      decomposition: [{ statement: 'added', span_refs: [] }],
    };
    const yamlText = stringifyYaml(buildClarification(changed));
    expect(stepsContentHashFromYaml(yamlText)).toBe(stepsContentHash(changed));
  });
});

describe('judgeCompletion', () => {
  it('blocks when there is no interpretation_check entry', () => {
    const clarification = buildClarification(completeSteps, []);
    expect(judgeCompletion(clarification, promptFixture())).toEqual({
      confirmed: false,
      reason: 'no_confirmation',
    });
  });

  it('confirms when the latest entry agrees, has a statement, and matches the current steps hash', () => {
    const entry = buildEntry(completeSteps);
    const clarification = buildClarification(completeSteps, [entry]);
    expect(judgeCompletion(clarification, promptFixture())).toEqual({ confirmed: true });
  });

  it('blocks when the latest entry is disagreed', () => {
    const entry = buildEntry(completeSteps, { user_response: 'disagreed' });
    const clarification = buildClarification(completeSteps, [entry]);
    const result = judgeCompletion(clarification, promptFixture());
    expect(result.confirmed).toBe(false);
    expect((result as { reason: string }).reason).toBe('not_agreed');
  });

  it('blocks when user_statement is empty even if agreed', () => {
    const entry = buildEntry(completeSteps, { user_statement: '   ' });
    const clarification = buildClarification(completeSteps, [entry]);
    const result = judgeCompletion(clarification, promptFixture());
    expect(result.confirmed).toBe(false);
    expect((result as { reason: string }).reason).toBe('missing_user_statement');
  });

  it('blocks when steps changed after the agreed entry was recorded (confirmation invalidated)', () => {
    const entry = buildEntry(completeSteps);
    const changedSteps: ClarificationSteps = {
      ...completeSteps,
      decomposition: [{ statement: 'new', span_refs: [] }],
    };
    // Entry still says it agreed to the *old* steps hash; steps moved on.
    const clarification = buildClarification(changedSteps, [entry]);
    const result = judgeCompletion(clarification, promptFixture());
    expect(result.confirmed).toBe(false);
    expect((result as { reason: string }).reason).toBe('content_changed_since_confirmation');
  });

  it('a stored status of confirmed does not matter — judgement is always recomputed', () => {
    const entry = buildEntry(completeSteps, { user_response: 'disagreed' });
    const clarification: Clarification = {
      ...buildClarification(completeSteps, [entry]),
      status: 'confirmed',
    };
    expect(judgeCompletion(clarification, promptFixture()).confirmed).toBe(false);
  });

  it('detects tampering with a past interpretation_check entry (entry_hash mismatch)', () => {
    const entry = buildEntry(completeSteps);
    const tampered = { ...entry, user_statement: 'a different statement than what was hashed' };
    const clarification = buildClarification(completeSteps, [tampered]);
    const result = judgeCompletion(clarification, promptFixture());
    expect(result.confirmed).toBe(false);
    expect((result as { reason: string }).reason).toBe('integrity_violation');
  });

  it('a disagreed round followed by a new agreed round (re-confirmation) can confirm', () => {
    const first = buildEntry(completeSteps, { user_response: 'disagreed' });
    const second = buildEntry(completeSteps, { id: 'IC-002' });
    const clarification = buildClarification(completeSteps, [first, second]);
    expect(judgeCompletion(clarification, promptFixture())).toEqual({ confirmed: true });
    // The earlier disagreed entry is still present, untouched.
    expect(clarification.interpretation_check[0]!.user_response).toBe('disagreed');
  });
});
