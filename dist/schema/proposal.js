import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { canonicalJson, sha256Hex } from '../clarification/hash.js';
const hash = z.string().regex(/^[0-9a-f]{64}$/);
export const proposalRefSchema = z.object({ kind: z.enum(['prompt', 'clarification', 'node_group', 'node', 'graph', 'edge', 'relation_candidate', 'impact_report', 'finding', 'proposal', 'policy']), ref: z.string().min(1), content_hash: hash }).strict();
export const proposalFindingRefSchema = z.object({ finding_ref: z.string().regex(/^FND-[0-9a-f]{16}$/), claim_hash: hash, review_status: z.literal('confirmed') }).strict();
const coverage = z.object({ finding_ref: z.string().regex(/^FND-[0-9a-f]{16}$/), approach: z.string().trim().min(1), residual_issues: z.array(z.string().trim().min(1)) }).strict();
export const proposalOptionSchema = z.object({
    id: z.string().regex(/^[A-Z][A-Z0-9_-]{1,31}$/), description: z.string().trim().min(1), evidence_refs: z.array(proposalRefSchema).min(1),
    benefits: z.array(z.string().trim().min(1)).min(1), costs: z.array(z.string().trim().min(1)).min(1), risks: z.array(z.string().trim().min(1)).min(1),
    assumptions: z.array(z.string().trim().min(1)).min(1), expected_impacts: z.array(z.string().trim().min(1)).min(1), side_effects: z.array(z.string().trim().min(1)).min(1),
    target_candidates: z.array(proposalRefSchema), finding_coverage: z.array(coverage).min(1),
}).strict();
export const proposalInputSchema = z.object({
    finding_refs: z.array(proposalFindingRefSchema).min(1), input_snapshot: z.array(proposalRefSchema).min(1), options: z.array(proposalOptionSchema).min(2),
    ai_recommendation: z.object({ is_ai_recommendation: z.literal(true), option_ref: z.string(), rationale: z.string().trim().min(1), confidence: z.enum(['low', 'medium', 'high']), uncertainty: z.array(z.string().trim().min(1)).min(1) }).strict().optional(),
    supersedes_proposal_ref: z.string().regex(/^PROP-[0-9a-f]{16}$/).optional(),
}).strict().superRefine((value, ctx) => {
    const refs = value.finding_refs.map((f) => f.finding_ref);
    if (new Set(refs).size !== refs.length)
        ctx.addIssue({ code: 'custom', path: ['finding_refs'], message: 'Finding references must be unique.' });
    const optionIds = value.options.map((o) => o.id);
    if (new Set(optionIds).size !== optionIds.length)
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'Option IDs must be unique.' });
    if (value.ai_recommendation && !optionIds.includes(value.ai_recommendation.option_ref))
        ctx.addIssue({ code: 'custom', path: ['ai_recommendation', 'option_ref'], message: 'Recommendation must reference an existing option.' });
    for (const [oi, option] of value.options.entries()) {
        const covered = option.finding_coverage.map((c) => c.finding_ref);
        if (new Set(covered).size !== covered.length || refs.some((ref) => !covered.includes(ref)) || covered.some((ref) => !refs.includes(ref)))
            ctx.addIssue({ code: 'custom', path: ['options', oi, 'finding_coverage'], message: 'Every option must state its approach and residual issues for each targeted Finding.' });
    }
});
export const proposalSchema = proposalInputSchema.extend({ schema_version: z.literal(1), id: z.string().regex(/^PROP-[0-9a-f]{16}$/), claim_hash: hash, fingerprint: hash, status: z.literal('pending'), selected_option_ref: z.never().optional(), created_at: z.string().datetime({ offset: true }), history: z.array(z.object({ event: z.literal('created'), at: z.string().datetime({ offset: true }), claim_hash: hash }).strict()).min(1) }).strict().superRefine((p, ctx) => {
    const input = { finding_refs: p.finding_refs, input_snapshot: p.input_snapshot, options: p.options, ...(p.ai_recommendation ? { ai_recommendation: p.ai_recommendation } : {}), ...(p.supersedes_proposal_ref ? { supersedes_proposal_ref: p.supersedes_proposal_ref } : {}) };
    const fingerprint = sha256Hex(canonicalJson(input));
    if (p.claim_hash !== fingerprint)
        ctx.addIssue({ code: 'custom', path: ['claim_hash'], message: 'Proposal claim hash is invalid.' });
    if (p.id !== `PROP-${fingerprint.slice(0, 16)}` || p.fingerprint !== fingerprint)
        ctx.addIssue({ code: 'custom', path: ['fingerprint'], message: 'Proposal fingerprint or ID is invalid.' });
    if (p.history[0]?.claim_hash !== fingerprint)
        ctx.addIssue({ code: 'custom', path: ['history'], message: 'Proposal creation history must bind the immutable claim hash.' });
});
export function createProposal(inputValue, now = new Date()) {
    const input = proposalInputSchema.parse(inputValue);
    const fingerprint = sha256Hex(canonicalJson(input));
    const id = `PROP-${fingerprint.slice(0, 16)}`;
    const claim_hash = fingerprint;
    const at = now.toISOString();
    return proposalSchema.parse({ ...input, schema_version: 1, id, fingerprint, claim_hash, status: 'pending', created_at: at, history: [{ event: 'created', at, claim_hash }] });
}
export function parseProposal(value) { let decoded; try {
    decoded = parseYaml(value);
}
catch (e) {
    throw new Error(`Invalid Proposal YAML: ${e instanceof Error ? e.message : String(e)}`);
} return proposalSchema.parse(decoded); }
//# sourceMappingURL=proposal.js.map