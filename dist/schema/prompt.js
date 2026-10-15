import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { segmentSpans } from '../clarification/spans.js';
import { canonicalJson, sha256Hex } from '../clarification/hash.js';
/**
 * A Prompt is append-only: once intake() writes one, nothing later edits
 * raw_text. A corrected prompt becomes a new PRM-xxx record.
 */
export const promptSpanSchema = z.object({
    id: z.string().min(1),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
});
export const promptSchema = z.object({
    id: z.string().regex(/^PRM-\d{3,}$/, 'Prompt id must look like PRM-001'),
    raw_text: z.string().min(1, 'raw_text must not be empty'),
    received_at: z.string().min(1),
    content_hash: z.string().regex(/^[0-9a-f]{64}$/, 'content_hash must be a SHA-256 hex digest'),
    spans: z.array(promptSpanSchema),
    /** Segmentation rule the spans were cut with; missing means 1. */
    segmentation: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
});
/** SHA-256 of the raw prompt text. The same text always yields the same hash. */
export function computePromptHash(rawText) {
    return sha256Hex(rawText);
}
export function parsePrompt(yamlText) {
    return promptSchema.parse(parseYaml(yamlText));
}
/** Raw text and the original deterministic span segmentation must still agree. */
export function promptIntegrityIssue(prompt) {
    if (!promptSchema.safeParse(prompt).success)
        return 'Invalid Prompt schema.';
    if (computePromptHash(prompt.raw_text) !== prompt.content_hash)
        return 'Prompt raw text does not match content_hash.';
    if (canonicalJson(prompt.spans) !== canonicalJson(segmentSpans(prompt.raw_text, prompt.segmentation ?? 1)))
        return 'Prompt spans do not match original text segmentation.';
    return undefined;
}
//# sourceMappingURL=prompt.js.map