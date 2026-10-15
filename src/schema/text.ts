/** A finite structural placeholder check; never a judgement of natural-language quality. */
/**
 * Characters that change what a reader sees without changing what a parser
 * sees: C0/C1 controls (ANSI escapes), zero-width and bidi format
 * characters, and HTML comment openers. None belongs in a product artifact.
 */
export function forbiddenTextIssue(text: string): string | undefined {
  const m = text.match(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u180e\u200b-\u200f\u2028-\u202e\u2060-\u2069\u2800\u3164\ufeff\uffa0]|[\u{e0000}-\u{e007f}]/u);
  if (m) return `contains a control or invisible character U+${m[0]!.codePointAt(0)!.toString(16).padStart(4, '0')}`;
  if (text.includes('<!--')) return 'contains an HTML comment opener (<!--)';
  if (/<\/?(script|style|iframe)\b/i.test(text)) return 'contains an HTML script/style/iframe tag';
  return undefined;
}

/**
 * A statement recorded as agreement/approval that itself says no. The CLI
 * cannot judge meaning, but it can refuse the obvious contradiction instead
 * of filing "승인하지 않는다" as an approval.
 */
export function saysNo(statement: string): boolean {
  return /(않|안\s|못|불가|반대|거부|거절|아니|틀렸|취소|no\b|not\b|never|reject|disagree|wrong)/i.test(statement);
}

export function isMeaningfulText(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length > 0 && !/^[\s.\-–—_?…]+$/.test(text) &&
    !/^(tbd|todo|unknown|placeholder|n\/?a|null|undefined|미정|미작성|작성 예정|알 수 없음|해당 없음)$/i.test(text);
}
