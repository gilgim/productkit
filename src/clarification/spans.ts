export interface Span {
  id: string;
  start: number;
  end: number;
}

/**
 * Splits text at sentence-ending punctuation or line breaks so later steps
 * can reference a specific stretch of the original prompt by id. This is a
 * mechanical boundary split, not linguistic sentence detection — the CLI
 * does not interpret meaning, only character offsets.
 */
export function segmentSpans(text: string): Span[] {
  const spans: Span[] = [];
  const boundary = /[.!?]+|\n+/g;
  let start = 0;
  let index = 1;
  let match: RegExpExecArray | null;

  while ((match = boundary.exec(text)) !== null) {
    const end = match.index + match[0].length;
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
