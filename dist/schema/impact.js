import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { candidateEvidenceRefSchema } from './graph.js';
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const pathWitness = z.object({
    edge_ref: z.string(), type: z.string(), from: z.string(), to: z.string(), traversal: z.enum(['forward', 'reverse']),
    basis: z.string(), reason: z.string(), effective_status: z.enum(['confirmed', 'proposed', 'rejected']), freshness: z.enum(['fresh', 'stale']),
});
const impactEntry = z.object({
    node_ref: z.string(), certainty: z.enum(['confirmed', 'potential']), effect: z.enum(['dependency_candidate', 'review_candidate']),
    depth: z.number().int().nonnegative(), direct: z.boolean(), path: z.array(pathWitness), warnings: z.array(z.string()),
});
export const blockedInputSchema = z.object({
    code: z.string(), ref: z.string().optional(), candidate_ref: z.string().optional(), reason: z.string(),
});
export const impactReportSchema = z.object({
    schema_version: z.literal(1), analysis_id: z.string(), seed_node_ref: z.string(), rules_version: z.string(),
    input_fingerprint: sha256, completeness: z.enum(['complete', 'incomplete']),
    confirmed_impacts: z.array(impactEntry), potential_impacts: z.array(impactEntry),
    review_candidates: z.object({ confirmed: z.array(impactEntry), potential: z.array(impactEntry) }),
    blocked_inputs: z.array(blockedInputSchema), warnings: z.array(z.string()), created_at: z.string().datetime({ offset: true }),
}).strict();
export function parseImpactReport(text) {
    return impactReportSchema.parse(parseYaml(text));
}
//# sourceMappingURL=impact.js.map