/** A finite structural placeholder check; never a judgement of natural-language quality. */
export function isMeaningfulText(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length > 0 && !/^[\s.\-–—_?…]+$/.test(text) &&
    !/^(tbd|todo|unknown|placeholder|n\/?a|null|undefined|미정|미작성|작성 예정|알 수 없음|해당 없음)$/i.test(text);
}
