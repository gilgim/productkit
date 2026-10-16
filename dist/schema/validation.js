import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { canonicalJson, sha256Hex } from '../clarification/hash.js';
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const typedRef = z.object({ kind: z.string().min(1), ref: z.string().min(1), content_hash: hash }).strict();
export const semanticAreas = z.enum(['requirement_completeness', 'user_flow', 'policy_consistency', 'acceptance_criteria', 'assumptions', 'graph_impact', 'traceability', 'counterexamples']);
/** One verdict per (Definition item, source Node) pair: does the item say what the Node says? */
export const itemFidelitySchema = z.object({ item_ref: z.string().regex(/^(ITM-[0-9a-f]{12}|POL-[0-9a-f]{16}|JRN-[0-9a-f]{16})$/), node_ref: z.string().min(1), verdict: z.enum(['same', 'narrower', 'broader', 'contradicts']), reason: z.string().trim().min(1) }).strict();
const semanticReviewObject = z.object({ schema_version: z.literal(1), id: z.string().regex(/^SEM-[0-9a-f]{16}$/), definition_ref: z.string().min(1), definition_hash: hash, input_fingerprint: hash, assessor: z.enum(['ai', 'user']), scope: z.string().trim().min(1), areas: z.record(semanticAreas, z.object({ status: z.enum(['reviewed', 'not_applicable', 'not_reviewed']), evidence_refs: z.array(typedRef), rationale: z.string().trim().min(1) }).strict()), item_fidelity: z.array(itemFidelitySchema).default([]), unreviewed_scope_resolved: z.array(z.object({ item: z.string().trim().min(1), evidence_refs: z.array(typedRef).min(1) }).strict()).default([]), finding_refs: z.array(z.string().min(1)), unreviewed_scope: z.array(z.string().trim().min(1)), uncertainty: z.array(z.string().trim().min(1)).min(1), summary: z.string().trim().min(1), created_at: z.string().datetime({ offset: true }), content_hash: hash }).strict();
export const semanticReviewSchema = semanticReviewObject.superRefine((v, c) => { const { id, content_hash, created_at, ...body } = v; if (v.content_hash !== sha256Hex(canonicalJson(body)) || v.id !== `SEM-${v.content_hash.slice(0, 16)}`)
    c.addIssue({ code: 'custom', message: 'Semantic review ID/hash mismatch.' }); });
export const validationCheckSchema = z.object({ id: z.string().trim().min(1), category: z.enum(['structure', 'traceability', 'finding', 'decision', 'application', 'journey', 'policy', 'assumption', 'impact', 'semantic']), status: z.enum(['pass', 'warn', 'fail', 'stale', 'not_assessed']), message: z.string().trim().min(1), refs: z.array(typedRef) }).strict();
export const validationReportSchema = z.object({ schema_version: z.literal(1), id: z.string().regex(/^VAL-[0-9a-f]{16}$/), definition_ref: z.string().min(1), definition_hash: hash, rules_version: z.string().min(1), input_snapshot: z.array(typedRef), input_fingerprint: hash, checks: z.array(validationCheckSchema).min(1), structural_status: z.enum(['pass', 'blocked']), semantic_status: z.enum(['pass', 'inconclusive', 'not_assessed', 'stale']), readiness: z.enum(['ready', 'blocked', 'stale']), review_ref: z.string().regex(/^SEM-[0-9a-f]{16}$/).optional(), created_at: z.string().datetime({ offset: true }), report_hash: hash }).strict().superRefine((v, c) => { const { id, report_hash, created_at, ...body } = v; if (v.report_hash !== sha256Hex(canonicalJson(body)) || v.id !== `VAL-${v.report_hash.slice(0, 16)}`)
    c.addIssue({ code: 'custom', message: 'ValidationReport ID/hash mismatch.' }); if (v.readiness === 'ready' && (v.structural_status !== 'pass' || v.semantic_status !== 'pass' || v.checks.some(x => x.status === 'fail' || x.status === 'stale' || x.status === 'not_assessed')))
    c.addIssue({ code: 'custom', message: 'Ready report cannot contain blockers or missing semantic review.' }); });
export const approvalSchema = z.object({ schema_version: z.literal(1), id: z.string().regex(/^APR-[0-9a-f]{16}$/), definition_ref: z.string().min(1), definition_hash: hash, validation_ref: z.string().regex(/^VAL-[0-9a-f]{16}$/), validation_hash: hash, input_fingerprint: hash, user_statement: z.string().trim().min(1), scope: z.string().trim().min(1), attestation: z.enum(['tty', 'flag']), created_at: z.string().datetime({ offset: true }), supersedes_ref: z.string().regex(/^APR-[0-9a-f]{16}$/).optional(), entry_hash: hash }).strict().superRefine((v, c) => { const { id, entry_hash, created_at, ...body } = v; if (v.entry_hash !== sha256Hex(canonicalJson(body)) || v.id !== `APR-${v.entry_hash.slice(0, 16)}`)
    c.addIssue({ code: 'custom', message: 'Approval ID/hash mismatch.' }); });
export function parseSemanticReview(s) { return semanticReviewSchema.parse(parseYaml(s)); }
export function parseValidationReport(s) { return validationReportSchema.parse(parseYaml(s)); }
export function parseApproval(s) { return approvalSchema.parse(parseYaml(s)); }
/**
 * A `reviewed` area must cite at least one product artifact. The skill file
 * itself is not evidence of having looked at the product. Returns the first
 * offending area, or undefined. Structural only: it cannot tell whether the
 * cited artifact is the right one for that area.
 */
/**
 * Which artifact kinds an area must cite to count as reviewed. "Cited
 * something" is not evidence of having looked at the right thing; this is
 * the minimum shape of the right thing. `anyOf` — at least one of these
 * kinds; `ifPresent` — required only when the workspace has that kind.
 */
export const AREA_EVIDENCE = {
    requirement_completeness: { allOf: [['prompt'], ['definition', 'node']] },
    user_flow: { allOf: [['journey', 'node', 'definition']] },
    policy_consistency: { allOf: [['definition', 'node']], ifPresent: ['policy'], notApplicableWhenAbsent: 'policy' },
    acceptance_criteria: { allOf: [['definition']] },
    assumptions: { allOf: [['finding', 'definition']], ifPresent: ['assumption'], notApplicableWhenAbsent: 'assumption' },
    graph_impact: { allOf: [['impact_report']] },
    traceability: { allOf: [['decision'], ['prompt']] },
    counterexamples: { allOf: [['finding', 'challenge_run']] },
};
export function semanticReviewIssue(review, presentKinds) { for (const [area, result] of Object.entries(review.areas)) {
    if (!result)
        continue;
    const rule = AREA_EVIDENCE[area];
    if (result.status === 'not_applicable') {
        if (!rule?.notApplicableWhenAbsent)
            return `Area ${area} can never be not_applicable; review it with evidence.`;
        if (presentKinds?.has(rule.notApplicableWhenAbsent))
            return `Area ${area} cannot be not_applicable while the workspace has ${rule.notApplicableWhenAbsent} records.`;
    }
    if (result.status === 'reviewed') {
        if (!result.evidence_refs.length)
            return `Area ${area} is marked reviewed but cites no evidence.`;
        if (result.evidence_refs.some(r => r.kind === 'skill' || r.kind === 'workspace'))
            return `Area ${area} cites a skill or workspace fingerprint as evidence; cite product artifacts.`;
        const kinds = new Set(result.evidence_refs.map(r => r.kind));
        for (const group of rule?.allOf ?? [])
            if (!group.some(k => kinds.has(k)))
                return `Area ${area} must cite at least one ${group.join('/')} artifact.`;
        for (const k of rule?.ifPresent ?? [])
            if (presentKinds?.has(k) && !kinds.has(k))
                return `Area ${area} must cite at least one ${k} artifact because the workspace has ${k} records.`;
    }
} return undefined; }
// Hash after the schema trims text and fills defaults (item_fidelity, unreviewed_scope_resolved), or the stored review never matches its hash.
export function createSemanticReview(v) { const { id: _id, content_hash: _stale, ...rest } = v; const parsed = semanticReviewObject.omit({ id: true, content_hash: true }).parse(rest); const { created_at: _created, ...body } = parsed; const content_hash = sha256Hex(canonicalJson(body)); return semanticReviewSchema.parse({ ...parsed, content_hash, id: `SEM-${content_hash.slice(0, 16)}` }); }
//# sourceMappingURL=validation.js.map