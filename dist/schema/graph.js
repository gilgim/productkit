import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { canonicalJson, sha256Hex } from '../clarification/hash.js';
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const nodeId = z.string().regex(/^NOD-\d{3,}-\d+$/);
export const GRAPH_RULES_VERSION = 'graph-impact/1';
export const graphRelationTypeSchema = z.enum([
    'depends_on', 'precedes', 'conflicts_with', 'duplicates', 'supersedes', 'exception_of',
]);
export const edgeConfirmationSchema = z.object({
    id: z.string().regex(/^ECF-[A-Za-z0-9-]+$/),
    edge_ref: z.string().regex(/^EDG-[A-Za-z0-9-]+$/),
    edge_claim_hash: sha256Schema,
    endpoint_snapshot_hashes: z.object({ source: sha256Schema, target: sha256Schema }),
    user_response: z.enum(['agreed', 'disagreed']),
    user_statement: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
    checked_at: z.string().datetime({ offset: true }),
    entry_hash: sha256Schema,
}).strict();
export const graphEdgeSchema = z.object({
    id: z.string().regex(/^EDG-[A-Za-z0-9-]+$/),
    type: graphRelationTypeSchema,
    source: nodeId,
    target: nodeId,
    basis: z.enum(['ai_inferred', 'explicit_text']),
    reason: z.string().trim().min(1),
    status: z.enum(['proposed', 'confirmed', 'rejected']),
    confirmations: z.array(edgeConfirmationSchema).default([]),
}).strict();
export const graphDocumentSchema = z.object({
    schema_version: z.literal(1),
    edges: z.array(graphEdgeSchema),
}).strict();
export const candidateEvidenceRefSchema = z.object({
    ref: z.string().trim().min(1),
    kind: z.enum(['prompt', 'span', 'clarification', 'node']),
}).strict();
export const candidateReviewEntrySchema = z.object({
    id: z.string().regex(/^RCF-[A-Za-z0-9-]+$/),
    candidate_ref: z.string().regex(/^RLC-[0-9a-f]{16}$/),
    candidate_hash: sha256Schema,
    review_status: z.enum(['reviewed', 'dismissed']),
    user_statement: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
    checked_at: z.string().datetime({ offset: true }),
    entry_hash: sha256Schema,
}).strict();
export const relationCandidateSchema = z.object({
    schema_version: z.literal(1),
    id: z.string().regex(/^RLC-[0-9a-f]{16}$/),
    original_relation_name: z.string().trim().min(1),
    source_node_ref: nodeId,
    target_node_ref: nodeId,
    proposed_meaning: z.string().trim().min(1),
    evidence_refs: z.array(candidateEvidenceRefSchema).min(1),
    review_status: z.enum(['pending', 'reviewed', 'dismissed']),
    created_at: z.string().datetime({ offset: true }),
    endpoint_snapshot_hashes: z.object({ source: sha256Schema, target: sha256Schema }).strict(),
    candidate_hash: sha256Schema,
    review_history: z.array(candidateReviewEntrySchema).default([]),
}).strict().superRefine((candidate, ctx) => {
    const fingerprint = relationCandidateFingerprint({
        original_relation_name: candidate.original_relation_name,
        source_node_ref: candidate.source_node_ref,
        target_node_ref: candidate.target_node_ref,
        proposed_meaning: candidate.proposed_meaning,
        evidence_refs: candidate.evidence_refs,
        endpoint_snapshot_hashes: candidate.endpoint_snapshot_hashes,
        created_at: candidate.created_at,
    });
    if (fingerprint !== candidate.candidate_hash || candidate.id !== `RLC-${fingerprint.slice(0, 16)}`) {
        ctx.addIssue({ code: 'custom', path: ['candidate_hash'], message: 'Candidate ID/hash does not match the candidate content.' });
    }
    if (graphRelationTypeSchema.safeParse(candidate.original_relation_name).success) {
        ctx.addIssue({ code: 'custom', path: ['original_relation_name'], message: 'Supported Edge types cannot be stored as unsupported candidates.' });
    }
    const last = candidate.review_history.at(-1);
    const expectedStatus = last?.review_status ?? 'pending';
    if (candidate.review_status !== expectedStatus) {
        ctx.addIssue({ code: 'custom', path: ['review_status'], message: 'review_status must match the latest append-only review entry.' });
    }
    candidate.review_history.forEach((entry, index) => {
        const { entry_hash, ...base } = entry;
        if (entry.candidate_ref !== candidate.id || entry.candidate_hash !== candidate.candidate_hash || entry_hash !== candidateReviewEntryHash(base)) {
            ctx.addIssue({ code: 'custom', path: ['review_history', index], message: 'Candidate review entry is invalid or does not bind to this candidate.' });
        }
    });
});
export function relationCandidateFingerprint(input) {
    const evidence = [...input.evidence_refs].sort((a, b) => `${a.kind}:${a.ref}`.localeCompare(`${b.kind}:${b.ref}`));
    return sha256Hex(canonicalJson({
        original_relation_name: input.original_relation_name.trim(),
        source_node_ref: input.source_node_ref,
        target_node_ref: input.target_node_ref,
        proposed_meaning: input.proposed_meaning.trim(),
        evidence_refs: evidence,
        endpoint_snapshot_hashes: input.endpoint_snapshot_hashes,
    }));
}
export function createRelationCandidate(input) {
    const evidence_refs = [...input.evidence_refs].sort((a, b) => `${a.kind}:${a.ref}`.localeCompare(`${b.kind}:${b.ref}`));
    const candidate_hash = relationCandidateFingerprint({ ...input, evidence_refs });
    return relationCandidateSchema.parse({
        schema_version: 1,
        id: `RLC-${candidate_hash.slice(0, 16)}`,
        original_relation_name: input.original_relation_name.trim(),
        source_node_ref: input.source_node_ref,
        target_node_ref: input.target_node_ref,
        proposed_meaning: input.proposed_meaning.trim(),
        evidence_refs,
        review_status: 'pending',
        created_at: input.created_at,
        endpoint_snapshot_hashes: input.endpoint_snapshot_hashes,
        candidate_hash,
        review_history: [],
    });
}
export function parseGraphDocument(text) {
    return graphDocumentSchema.parse(parseYaml(text));
}
export function parseRelationCandidate(text) {
    return relationCandidateSchema.parse(parseYaml(text));
}
export function graphEdgeClaimHash(edge) {
    return sha256Hex(canonicalJson({
        rules_version: GRAPH_RULES_VERSION,
        id: edge.id,
        type: edge.type,
        source: edge.source,
        target: edge.target,
        basis: edge.basis,
        reason: edge.reason,
    }));
}
export function confirmationEntryHash(entry) {
    return sha256Hex(canonicalJson(entry));
}
export function candidateReviewEntryHash(entry) {
    return sha256Hex(canonicalJson(entry));
}
export function relationKindAllowed(type, sourceKind, targetKind) {
    switch (type) {
        case 'depends_on': return ['requirement', 'policy'].includes(sourceKind) && ['requirement', 'policy'].includes(targetKind);
        case 'precedes': return sourceKind === 'requirement' && targetKind === 'requirement';
        case 'conflicts_with': return ['requirement', 'policy'].includes(sourceKind) && ['requirement', 'policy'].includes(targetKind);
        case 'duplicates': return sourceKind === targetKind && ['fact', 'inference', 'requirement', 'policy'].includes(sourceKind);
        case 'supersedes': return sourceKind === targetKind;
        case 'exception_of': return sourceKind === 'policy' && targetKind === 'policy';
    }
}
export const symmetricRelationTypes = new Set(['conflicts_with', 'duplicates']);
export const acyclicRelationTypes = new Set(['depends_on', 'precedes', 'supersedes', 'exception_of']);
//# sourceMappingURL=graph.js.map