/** A finite structural placeholder check; never a judgement of natural-language quality. */
/**
 * Characters that change what a reader sees without changing what a parser
 * sees: C0/C1 controls (ANSI escapes), zero-width and bidi format
 * characters, and HTML comment openers. None belongs in a product artifact.
 */
export function forbiddenTextIssue(text: string): string | undefined {
  const m = text.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/);
  if (m) return `contains a control or invisible character U+${m[0]!.codePointAt(0)!.toString(16).padStart(4, '0')}`;
  if (text.includes('<!--')) return 'contains an HTML comment opener (<!--)';
  return undefined;
}

export function isMeaningfulText(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length > 0 && !/^[\s.\-–—_?…]+$/.test(text) &&
    !/^(tbd|todo|unknown|placeholder|n\/?a|null|undefined|미정|미작성|작성 예정|알 수 없음|해당 없음)$/i.test(text);
}
