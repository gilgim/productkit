import { z } from 'zod';
import { canonicalJson, sha256Hex } from '../clarification/hash.js';
import { findingRefSchema } from './finding.js';

export const challengeAreaSchema = z.enum([
  'missing_requirements_exceptions', 'policy_conflicts_duplicates', 'flow_gaps',
  'condition_operator_consistency', 'graph_relation_risks', 'prompt_node_fidelity',
  'verifiability', 'impact_coverage',
]);
export const challengeAreaResultSchema = z.object({
  status: z.enum(['reviewed', 'not_applicable', 'not_reviewed']),
  rationale: z.string().trim().optional(),
  evidence_refs: z.array(findingRefSchema).default([]),
}).strict().superRefine((area, ctx) => {
  if (area.status === 'not_applicable' && !area.rationale?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['rationale'], message: 'Not applicable requires rationale.' });
  }
});
export const challengeInputSchema = z.object({
  kind: z.string().trim().min(1),
  ref: z.string().trim().min(1),
  content_hash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export const challengeHistorySchema = z.object({
  event: z.enum(['created', 'checkpointed', 'completed', 'invalidated']),
  at: z.string().datetime({ offset: true }),
  statement: z.string().trim().min(1),
  content_hash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export const challengeRunSchema = z.object({
  schema_version: z.literal(1),
  id: z.string().regex(/^CHL-[0-9a-f]{16}$/),
  status: z.enum(['in_progress', 'complete', 'incomplete', 'stale']),
  scope: z.object({ included: z.array(z.string().min(1)), excluded: z.array(z.object({ ref: z.string().min(1), reason: z.string().trim().min(1) }).strict()).default([]) }).strict(),
  areas: z.record(challengeAreaSchema, challengeAreaResultSchema),
  inputs: z.array(challengeInputSchema),
  finding_refs: z.array(z.string().regex(/^FND-[0-9a-f]{16}$/)),
  unavailable_inputs: z.array(z.object({ ref: z.string().min(1), reason: z.string().trim().min(1) }).strict()),
  skill_version: z.string().trim().min(1),
  rules_version: z.string().trim().min(1),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  review_hash: z.string().regex(/^[0-9a-f]{64}$/),
  history: z.array(challengeHistorySchema).min(1),
}).strict().superRefine((run, ctx) => {
  const hash = challengeRunHash({ ...run, review_hash: undefined });
  if (run.review_hash !== hash) ctx.addIssue({ code: 'custom', path: ['review_hash'], message: 'Challenge review hash mismatch.' });
  if (new Set(run.scope.included).size !== run.scope.included.length) ctx.addIssue({ code: 'custom', path: ['scope', 'included'], message: 'Duplicate scope reference.' });
});
export type ChallengeRun = z.infer<typeof challengeRunSchema>;
export const challengeAreas = challengeAreaSchema.options;

export function challengeRunHash(run: Omit<ChallengeRun, 'review_hash'> | (Omit<ChallengeRun, 'review_hash'> & { review_hash?: undefined })): string {
  const { review_hash: _ignored, ...base } = run as ChallengeRun;
  return sha256Hex(canonicalJson(base));
}

export function judgeChallengeCompletion(run: Pick<ChallengeRun, 'areas' | 'scope' | 'inputs' | 'unavailable_inputs' | 'status'>): 'complete' | 'incomplete' {
  if (run.status === 'stale' || run.unavailable_inputs.length > 0) return 'incomplete';
  if (!run.scope.included.length || !run.inputs.length) return 'incomplete';
  return challengeAreas.every((area) => {
    const result = run.areas[area];
    return result && (result.status === 'reviewed' || (result.status === 'not_applicable' && Boolean(result.rationale?.trim())));
  }) ? 'complete' : 'incomplete';
}
