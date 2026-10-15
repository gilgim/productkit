export interface Span {
    id: string;
    start: number;
    end: number;
}
/** Current segmentation rule. Prompts record the version they were cut with. */
export declare const SEGMENTATION_VERSION = 4;
/**
 * Splits text at sentence-ending punctuation or line breaks so later steps
 * can reference a specific stretch of the original prompt by id. This is a
 * mechanical boundary split, not linguistic sentence detection — the CLI
 * does not interpret meaning, only character offsets.
 *
 * Version 1 cut at every `.`, so "$12.50", "v1.2" and "e.g." became fragment
 * spans that were easy to dismiss as non-requirements. Version 2 cuts only at
 * punctuation followed by whitespace or end of text, and not after a single
 * ASCII letter (an abbreviation like "e.g."). Version 1 stays available so
 * Prompts taken in under it still verify.
 */
export declare function segmentSpans(text: string, version?: 1 | 2 | 3 | 4): Span[];
/** Numbers with their units/currency — the most concrete content a sentence carries. */
export declare function numberTokens(text: string): string[];
/** Content tokens: 2+ chars, punctuation stripped, Korean particles trimmed loosely. */
export declare function contentTokens(text: string): Set<string>;
export declare function polarityTokens(text: string): string[];
/** Headings, list markers, table separators and header rows: structure, not content. A heading that carries a number or a negation is content. */
export declare function isStructuralSpan(text: string): boolean;
/** A sentence that states something: Korean sentence-final endings or an English finite verb/modal. */
export declare function endsWithPredicate(text: string): boolean;
/** Korean connective endings that leave a clause open (a trigger-sharing split piece may end with one). */
export declare function endsWithConnective(text: string): boolean;
/** "단, …", "다만 …", "but …": an exception that only means something next to its rule. */
export declare function startsWithException(text: string): boolean;
/** Length of the longest common subsequence of two token lists. */
export declare function lcsLength(a: string[], b: string[]): number;
/** Content tokens in order (same normalisation as contentTokens, duplicates kept). */
export declare function contentTokenList(text: string): string[];
/** Verbatim text of one span, whitespace collapsed. */
export declare function spanText(rawText: string, span: Span): string;
/**
 * How many clause separators a span carries. A span with several separators
 * read into a single statement is where requirements get merged away, so
 * the author must say why one statement is enough. Mechanical count only.
 */
export declare function clauseSignalCount(text: string): number;
