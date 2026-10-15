import { z } from 'zod';
/**
 * A Prompt is append-only: once intake() writes one, nothing later edits
 * raw_text. A corrected prompt becomes a new PRM-xxx record.
 */
export declare const promptSpanSchema: z.ZodObject<{
    id: z.ZodString;
    start: z.ZodNumber;
    end: z.ZodNumber;
}, z.core.$strip>;
export declare const promptSchema: z.ZodObject<{
    id: z.ZodString;
    raw_text: z.ZodString;
    received_at: z.ZodString;
    content_hash: z.ZodString;
    spans: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, z.core.$strip>>;
    segmentation: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>>;
}, z.core.$strip>;
export type PromptSpan = z.infer<typeof promptSpanSchema>;
export type Prompt = z.infer<typeof promptSchema>;
/** SHA-256 of the raw prompt text. The same text always yields the same hash. */
export declare function computePromptHash(rawText: string): string;
export declare function parsePrompt(yamlText: string): Prompt;
/** Raw text and the original deterministic span segmentation must still agree. */
export declare function promptIntegrityIssue(prompt: Prompt): string | undefined;
