export interface Span {
  id: string;
  start: number;
  end: number;
}

/** Current segmentation rule. Prompts record the version they were cut with. */
export const SEGMENTATION_VERSION = 2;

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
export function segmentSpans(text: string, version: 1 | 2 = SEGMENTATION_VERSION): Span[] {
  const spans: Span[] = [];
  const boundary = version === 1 ? /[.!?]+|\n+/g : /[.!?]+(?=\s|$)|\n+/g;
  let start = 0;
  let index = 1;
  let match: RegExpExecArray | null;

  while ((match = boundary.exec(text)) !== null) {
    const end = match.index + match[0].length;
    if (version === 2 && !match[0].startsWith('\n')) {
      const before = text.slice(start, match.index);
      // "e.g." / "Dr." — a lone ASCII letter before the stop is not a sentence end.
      if (/(^|[\s(])[A-Za-z]$/.test(before)) continue;
    }
    if (text.slice(start, end).trim().length > 0) {
      spans.push({ id: `SPN-${String(index).padStart(3, '0')}`, start, end });
      index += 1;
    }
    start = end;
  }

  if (text.slice(start).trim().length > 0) {
    spans.push({ id: `SPN-${String(index).padStart(3, '0')}`, start, end: text.length });
  }

  return spans;
}

/** Verbatim text of one span, whitespace collapsed. */
export function spanText(rawText: string, span: Span): string {
  return rawText.slice(span.start, span.end).replace(/\s+/g, ' ').trim();
}

/**
 * How many clause separators a span carries. A span with several separators
 * read into a single statement is where requirements get merged away, so
 * the author must say why one statement is enough. Mechanical count only.
 */
export function clauseSignalCount(text: string): number {
  const matches = text.match(/[,;·/]|、|(?:그리고|및|또는)(?=\s)|(?:하고|하며|이며|이고)(?=[\s,.])|\b(?:and|or)\b/g);
  return matches ? matches.length : 0;
}
