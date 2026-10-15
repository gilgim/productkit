/** A finite structural placeholder check; never a judgement of natural-language quality. */
/**
 * Characters that change what a reader sees without changing what a parser
 * sees: C0/C1 controls (ANSI escapes), zero-width and bidi format
 * characters, and HTML comment openers. None belongs in a product artifact.
 */
export declare function forbiddenTextIssue(text: string): string | undefined;
/**
 * A statement recorded as agreement/approval that itself says no. The CLI
 * cannot judge meaning, but it can refuse the obvious contradiction instead
 * of filing "승인하지 않는다" as an approval.
 */
/** Fields that hold one sentence may not hold a line break: a line break is how an exported document grows a fake section. */
export declare function multilineIssue(text: string): string | undefined;
export declare function saysNo(statement: string): boolean;
export declare function isMeaningfulText(value: unknown): value is string;
