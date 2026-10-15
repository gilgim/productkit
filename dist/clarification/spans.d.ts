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
/** A question: a question mark anywhere, or a Korean interrogative ending (할까, 하나요, 할지, 인가요 …). */
export declare function isQuestion(text: string): boolean;
/** Something the user has not decided: "TBD", "미정", "추후 결정", "검토 필요", "모르겠다", "고민 중" … It is a question in disguise and goes to finding_candidates. */
export declare function isUndecided(text: string): boolean;
/** Pure structure: a line with no words of its own — a table separator, a bare list number or bullet, a bare heading mark. The CLI sets these aside itself; nothing else can be set aside. */
export declare function isPureStructure(text: string): boolean;
/** A line the user marked as an aside: "예:", "비유:", "참고:", "비고:", "주:", "note:", "e.g.". Only such lines, and structure, may be set aside. */
export declare function hasAsideMarker(text: string): boolean;
/** Korean conditional connective: a clause that is only a condition. */
export declare function endsWithCondition(text: string): boolean;
/** The sentence-initial condition of a Korean sentence, if it starts with one: "결제가 완료되면". */
export declare function leadingCondition(text: string): string | undefined;
/** English clause that trails off: a conjunction or preposition as the last word. */
export declare function endsWithDangler(text: string): boolean;
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
