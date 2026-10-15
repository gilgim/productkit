/** A finite structural placeholder check; never a judgement of natural-language quality. */
/**
 * Characters that change what a reader sees without changing what a parser
 * sees: C0/C1 controls (ANSI escapes), zero-width and bidi format
 * characters, and HTML comment openers. None belongs in a product artifact.
 */
export function forbiddenTextIssue(text: string): string | undefined {
  const m = text.match(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\u2800\u3164\ufeff\ufff9-\ufffc\uffa0]|[\u{1d173}-\u{1d17a}]|[\u{e0000}-\u{e007f}]|[\u{e0100}-\u{e01ef}]/u);
  if (m) return `contains a control or invisible character U+${m[0]!.codePointAt(0)!.toString(16).padStart(4, '0')}`;
  if (text.includes('<!--')) return 'contains an HTML comment opener (<!--)';
  if (/<\/?[a-z!?]/i.test(text)) return 'contains an HTML/XML tag opener (<tag); write "<" with a space after it';
  if (/javascript:/i.test(text)) return 'contains a javascript: URL';
  if (/&#|\]\(|!\[/.test(text)) return 'contains markdown link/image syntax or an HTML entity';
  return undefined;
}

/**
 * A statement recorded as agreement/approval that itself says no. The CLI
 * cannot judge meaning, but it can refuse the obvious contradiction instead
 * of filing "승인하지 않는다" as an approval.
 */
/** Fields that hold one sentence may not hold a line break: a line break is how an exported document grows a fake section. */
export function multilineIssue(text: string): string | undefined {
  if (/[\r\n]/.test(text)) return 'contains a line break';
  if (text.length > 2000) return `is ${text.length} characters long (limit 2000)`;
  return undefined;
}

export function saysNo(statement: string): boolean {
  return /(않|안\s|안돼|안됨|안함|못|불가|불승인|비승인|불허|기각|부결|유보|반대|거부|거절|반려|보류|대기|철회|중단|나중|아직|검토 중|넘어가|패스|다시|수정|미승인|조건부|아니|아님|아닙|틀렸|틀림|취소|싫|별로|글쎄|모르|하지마|그만|ㄴㄴ|\?|^n$|\bno\b|\bnot\b|never|reject|disagree|disapprove|wrong|\bhold\b|on hold|pending|defer|decline|denied|nope|nah|stop|abort|skip|don't|maybe|conditional|unsure|\bwait\b|postpone|veto|oppose|refuse|cancel|revise|needs work|incomplete|unapproved|\bfalse\b|nothing|\bnone\b|\bnull\b|guess|opposite)/i.test(statement.trim());
}

/** A Decision names a choice; the choice may itself be "cancel" or "no refund". Only a statement that opens as a refusal is one. */
export function startsWithRefusal(statement: string): boolean {
  const head = statement.trim().split(/\s+/).slice(0, 2).join(' ');
  return /^(아니|아뇨|아냐|아니오|아니요|싫|안 |안해|안할|못해|거부|거절|반대|보류|취소해|취소할게|그만|하지마|ㄴㄴ|글쎄|모르|no\b|nope|nah|not\b|never|stop|wait|hold|cancel this|don't|refuse|reject|decline|disagree)/i.test(head);
}

export function isMeaningfulText(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length > 0 && !/^[\s.\-–—_?…]+$/.test(text) &&
    !/^(tbd|todo|unknown|placeholder|n\/?a|null|undefined|미정|미작성|작성 예정|알 수 없음|해당 없음)$/i.test(text);
}
