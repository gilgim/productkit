/** A finite structural placeholder check; never a judgement of natural-language quality. */
/**
 * Characters that change what a reader sees without changing what a parser
 * sees: C0/C1 controls (ANSI escapes), zero-width and bidi format
 * characters, and HTML comment openers. None belongs in a product artifact.
 */
export declare function forbiddenTextIssue(text: string): string | undefined;
export declare function isMeaningfulText(value: unknown): value is string;
