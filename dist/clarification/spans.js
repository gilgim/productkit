/** Current segmentation rule. Prompts record the version they were cut with. */
export const SEGMENTATION_VERSION = 4;
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
    // v4: CJK full stops (。！？) end a sentence too, with or without a following space.
    const boundary = version === 1 ? /[.!?]+|\n+/g : version >= 4 ? /[。！？]+|[.!?]+(?=\s|$)|\n+/g : /[.!?]+(?=\s|$)|\n+/g;
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
const POLARITY = /(어떤 경우에도|언제든지|무조건|불허|결코|전혀|말 것|말것|마라|말아야|하지 말|안된다|안됨|제한|한정|금지|전용|차단|거부|거절|중지|취소|승인|필요|대신|불가능|불가|없이|없다|없음|없는|않는|않고|않은|않아|않음|않도록|안\s|못\s|못한|아니|금지|제외|예외|단,|만\s|만$|만으로|만이|에만|경우에만|이상|이하|미만|초과|이내|이전|이후|전에|전까지|후에|반드시|필수|항상|절대|모든|전부|즉시|최대|최소|최소한|적어도|\bnot\b|\bno\b|\bnever\b|\bonly\b|\bunless\b|\bexcept\b|\bmust\b|\bbefore\b|\bafter\b|\bat least\b|\bat most\b|\bwithin\b|\ball\b|\bevery\b)/g;
export function polarityTokens(text) {
    return (text.match(POLARITY) ?? []).map((t) => t.trim().replace(/,$/, ''));
}
/** Headings, list markers, table separators and header rows: structure, not content. A heading that carries a number or a negation is content. */
export function isStructuralSpan(text) {
    const t = text.trim();
    // A heading that reads like a sentence (particles, a verb-ish ending) is content with a hash in front of it.
    const sentenceLike = /(은|는|이|가|을|를|로|으로|에|에서|만|의)(\s|$)/.test(t.replace(/^#{1,6}\s*/, ''));
    const plain = !/\d/.test(t) && polarityTokens(t).length === 0 && !endsWithPredicate(t) && !sentenceLike;
    return (/^#{1,6}\s/.test(t) && plain) || /^\d{1,3}\.?$/.test(t) || /^[-*+]\s*$/.test(t) || /^\|?[\s|:-]+\|?$/.test(t) || (/^\|?\s*[^|]*(\|[^|]*)*\|?$/.test(t) && plain && t.includes('|'));
}
/** A question: a question mark anywhere, or a Korean interrogative ending (할까, 하나요, 할지, 인가요 …). */
export function isQuestion(text) {
    const t = text.trim().replace(/[\s.。!！)\]”"'’]+$/, '');
    return /[?？]/.test(text) || /(까|나요|가요|ㄴ가요|인가|인가요|한가|는가|던가|려나|으려나|할지|될지|을지|인지|습니까|ㅂ니까|합니까|있나|없나|되나|할까요)$/.test(t);
}
/** Something the user has not decided: "TBD", "미정", "추후 결정", "검토 필요", "모르겠다", "고민 중" … It is a question in disguise and goes to finding_candidates. */
export function isUndecided(text) {
    return /(\bTBD\b|\bTBC\b|\bTBA\b|미정|미확정|미결정|추후|나중에\s*정|안\s*정함|안\s*정했|정하지\s*못|협의\s*후|협의한다|협의\s*필요|검토\s*필요|검토\s*중|검토\s*예정|여부\s*검토|여부는\s*검토|논의\s*필요|논의\s*중|논의\s*예정|논의한다|정해지지\s*않|정하지\s*않|확정되지\s*않|결정되지\s*않|확정\s*전|보류|모르겠|모름|몰라|고민\s*중|확인\s*요망|확인\s*필요|확인\s*바람|필요한지|인지\s*확인|알려\s*주세요|알려\s*줘|중\s*하나다|중\s*하나이다|둘\s*중|결정\s*필요|결정\s*예정|안\s*정해|고려\s*중|고려한다|검토해\s*본다|검토한다|선정\s*예정|모른다|불명|불확실|애매|정해지는\s*대로|임시로|가안|\bTODO\b|\bFIXME\b|\bTBD\b|○○|OO일|xx일|\bN일|___|\[미입력\]|일\s*수\s*있다|상황에\s*따라|협의로|담당자가\s*정|(^|\s)일단[\s,]|(^|\s)아마[\s도]|잠정|후속\s*정책|별도\s*공지|재량|경우에\s*따라|판단에\s*맡|생각\s*중|가정한다|당분간|베타\s*기간|변경될\s*수|노력한다|목표로\s*한다|대체로|정해진\s*바\s*없|whatever\b|will be (set|decided|defined) by|undecided|to be (decided|determined|confirmed|announced|defined|specified)|not (yet |been |yet been )?(decided|sure|determined|confirmed|settled|defined|specified)|decided later|\bdepends\b|pending decision|open question|unclear|unknown|\bmaybe\b|\bmight\b|\bpossibly\b|\bprobably\b|\baround\b|\bN\/A\b|may be added|\beither\b.*\bor\b|could be)/i.test(text);
}
/** Pure structure: a line with no words of its own — a table separator, a bare list number or bullet, a bare heading mark. The CLI sets these aside itself; nothing else can be set aside. */
export function isPureStructure(text) {
    const t = text.trim();
    // Only separator/bullet/punctuation lines are structure. A bare number ("0", "7.", "100") is a value; a mark
    // ("✓", "✗", "%", "→", an emoji) means something next to its line: both are read, never set aside.
    return t === '' || /^[\s|:\-=_*+•▪■◦·#.,;`]+$/.test(t);
}
/** A line the user marked as an aside: "예:", "비유:", "참고:", "비고:", "주:", "note:", "e.g.". Only such lines, and structure, may be set aside. */
export function hasAsideMarker(text) {
    return /^(예|예시|비유|참고|비고|주|메모|note|e\.g\.|eg|tip|hint)\s*[:：]/i.test(text.trim());
}
/** Korean conditional connective: a clause that is only a condition. */
export function endsWithCondition(text) {
    const t = text.trim().replace(/[.。!?,，]+$/, '').trim();
    return /(하면|되면|이면|라면|다면|으면|면)$/.test(t) && !/(면|화면|장면|측면|지면|당면|대면|전면|후면|표면|내면|외면|서면|도면|단면|수면|라면)$/.test(t.replace(/(하면|되면|이면|다면|으면)$/, 'X'));
}
/** The sentence-initial condition of a Korean sentence, if it starts with one: "결제가 완료되면". */
export function leadingCondition(text) {
    const m = text.trim().match(/^((?:\S+\s+){0,5}?\S+(?:하면|되면|이면|라면|다면|으면|면)),?\s/);
    return m ? m[1] : undefined;
}
/** English clause that trails off: a conjunction or preposition as the last word. */
export function endsWithDangler(text) {
    return /\b(unless|if|when|whenever|because|and|or|but|that|which|while|until|before|after|only|not|except|without|with|to|of|for|the|a|an)$/i.test(text.trim().replace(/[.。!?,]+$/, ''));
}
/** A sentence that states something: Korean sentence-final endings or an English finite verb/modal. */
export function endsWithPredicate(text) {
    const t = text.trim().replace(/[.。!?！？)\]”"'’]+$/, '').trim();
    return /(다|요|니다|습니다|함|됨|음|임|것|가능|불가|필수|제외|포함)$/.test(t) || /\b(must|shall|should|will|can|cannot|may|is|are|does|do|has|have)\b/i.test(t);
}
/** Korean connective endings that leave a clause open (a trigger-sharing split piece may end with one). */
export function endsWithConnective(text) {
    const t = text.trim().replace(/[.。!?,，]+$/, '').trim();
    return /(고|며|하면|되면|이면|라면|지만|으나|거나|하되|되되|and|or|but)$/i.test(t);
}
/** "단, …", "다만 …", "but …": an exception that only means something next to its rule. */
export function startsWithException(text) {
    const t = text.trim().replace(/^(?:[\s\-*+•▪※■◦·(\[【「『"'“‘>–—→☞✔✓○▶・_~`❗⚠️❶❷❸①②③]|\[[ x]\]|\d{1,3}[.)]|[a-z][.)]|#{1,6})+\s*/i, '').replace(/^[\s\-*+•▪※■◦·(\[【「『"'“‘>–—→☞✔✓○▶・_~`❗⚠️❶❷❸①②③]+/, '');
    return /^(단[,，、:：\s]|단서[:：]|다만[,，\s]|단지[,，\s]|예외[:：]|예외 ?사항[:：은는]|예외로|예외적으로|예외는|그러나|하지만|그렇지만|그런데|근데|대신|반면|물론|그렇지 않으면|그렇지 않은 경우|그 ?외에는|그 ?외 경우|그 ?밖에는|아니면|다음은 예외|cf\.|n\.b\.|note[:：]|ただし|但是|除外|but\b|except\b|exception[:：]?|excepting\b|excluding\b|exempt\b|unless\b|however\b|otherwise\b|although\b|though\b|with the exception of|apart from|save for|barring\b|provided that|only if|still,|yet\b|if not,)/i.test(t) || /(제외한다|제외된다|제외함|제외다|제외이다|제외합니다|제외|예외다|예외이다|예외입니다|예외로 한다|면제한다|면제된다|적용하지 않는다|적용되지 않는다|해당하지 않는다|빼고|빼면|만 해당|해당되지 않는다|해당 안 됨|해당하지 않음|면제다|면제이다|열외다|대상이 아니다|별도로 처리한다|제외하고 적용한다)[.。!]?$/.test(t) || /^(나머지는|그 ?이외에는|그 ?외의 경우|그렇지 않을 때|아닌 경우에는|예외 ?상황|staff are exempt|other than\b|besides\b|excludes\b|in case of\b|this does not apply|doesn't apply|does not apply)/i.test(t);
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