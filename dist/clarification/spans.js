/** Current segmentation rule. Prompts record the version they were cut with. */
export const SEGMENTATION_VERSION = 3;
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
export function segmentSpans(text, version = SEGMENTATION_VERSION) {
    const spans = [];
    const boundary = version === 1 ? /[.!?]+|\n+/g : /[.!?]+(?=\s|$)|\n+/g;
    let start = 0;
    let index = 1;
    let match;
    while ((match = boundary.exec(text)) !== null) {
        const end = match.index + match[0].length;
        if (version >= 2 && !match[0].startsWith('\n')) {
            const before = text.slice(start, match.index);
            // "e.g." / "Dr." — a lone ASCII letter before the stop is not a sentence end.
            if (/(^|[\s(])[A-Za-z]$/.test(before))
                continue;
            if (version >= 3) {
                // v3: short ASCII abbreviations ("vs.", "Dr.", "etc."), dotted ones
                // ("U.S.", "i.e.", "e.g.") and list markers at line start ("1.", "12.")
                // are not sentence ends either.
                if (/(^|[\s(])[A-Za-z]{1,3}$/.test(before) || /[A-Za-z]\.[A-Za-z]$/.test(before) || /(^|\n)\s*\d{1,3}$/.test(before))
                    continue;
            }
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
/** Numbers with their units/currency — the most concrete content a sentence carries. */
export function numberTokens(text) {
    return (text.match(/[$₩€£]?\d[\d.,:~\-]*\d?[%]?[가-힣A-Za-z]{0,3}/g) ?? []).map((t) => t.replace(/[.,]$/, ''));
}
/** Content tokens: 2+ chars, punctuation stripped, Korean particles trimmed loosely. */
export function contentTokens(text) {
    const out = new Set();
    for (const raw of text.split(/[\s,.;:!?()\[\]{}"'`“”‘’·/|]+/)) {
        const t = raw.replace(/(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|까지|부터|마다)$/, '');
        if (t.length >= 2)
            out.add(t.toLowerCase());
    }
    return out;
}
/**
 * Words that flip or bound a requirement. Dropping one of these from a
 * restatement changes what is required; they are kept like numbers are.
 */
const POLARITY = /(불가능|불가|없이|없다|없음|없는|않는|않고|않은|않아|않음|않도록|안\s|못\s|못한|아니|금지|제외|예외|단,|만\s|만으로|만이|에만|경우에만|이상|이하|미만|초과|이내|이전|이후|전에|전까지|후에|반드시|필수|항상|절대|모든|전부|즉시|최대|최소|최소한|적어도|\bnot\b|\bno\b|\bnever\b|\bonly\b|\bunless\b|\bexcept\b|\bmust\b|\bbefore\b|\bafter\b|\bat least\b|\bat most\b|\bwithin\b|\ball\b|\bevery\b)/g;
export function polarityTokens(text) {
    return (text.match(POLARITY) ?? []).map((t) => t.trim().replace(/,$/, ''));
}
/** Headings, list markers, table separators and header rows: structure, not content. */
export function isStructuralSpan(text) {
    const t = text.trim();
    return /^#{1,6}\s/.test(t) || /^\d{1,3}\.?$/.test(t) || /^[-*+]\s*$/.test(t) || /^\|?[\s|:-]+\|?$/.test(t) || /^\|?\s*[^|]*(\|[^|]*)*\|?$/.test(t) && !/\d/.test(t) && polarityTokens(t).length === 0 && t.includes('|');
}
/** Length of the longest common subsequence of two token lists. */
export function lcsLength(a, b) {
    const dp = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
        let prev = 0;
        for (let j = 1; j <= b.length; j++) {
            const tmp = dp[j];
            dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
            prev = tmp;
        }
    }
    return dp[b.length];
}
/** Content tokens in order (same normalisation as contentTokens, duplicates kept). */
export function contentTokenList(text) {
    const out = [];
    for (const raw of text.split(/[\s,.;:!?()\[\]{}"'`“”‘’·/|]+/)) {
        const t = raw.replace(/(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|까지|부터|마다)$/, '');
        if (t.length >= 2)
            out.push(t.toLowerCase());
    }
    return out;
}
/** Verbatim text of one span, whitespace collapsed. */
export function spanText(rawText, span) {
    return rawText.slice(span.start, span.end).replace(/\s+/g, ' ').trim();
}
/**
 * How many clause separators a span carries. A span with several separators
 * read into a single statement is where requirements get merged away, so
 * the author must say why one statement is enough. Mechanical count only.
 */
export function clauseSignalCount(text) {
    const matches = text.match(/[,;·/]|、|(?:그리고|및|또는)(?=\s)|(?:하고|하며|이며|이고)(?=[\s,.])|\b(?:and|or)\b/g);
    return matches ? matches.length : 0;
}
//# sourceMappingURL=spans.js.map