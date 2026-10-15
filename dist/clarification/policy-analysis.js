const MAX_TERMS = 64;
function dnf(expression) {
    if (!expression || typeof expression !== 'object')
        return undefined;
    const node = expression;
    if (node.op === 'not')
        return undefined;
    if (['eq', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(node.op) && node.field && node.value_type && node.value !== undefined)
        return [[{ op: node.op, field: node.field, value_type: node.value_type, value: node.value, ...(node.unit ? { unit: node.unit } : {}) }]];
    if ((node.op !== 'all' && node.op !== 'any') || !node.args?.length)
        return undefined;
    const terms = node.args.map(dnf);
    if (terms.some(term => !term))
        return undefined;
    if (node.op === 'any') {
        const combined = terms.flatMap(term => term);
        return combined.length <= MAX_TERMS ? combined : undefined;
    }
    let product = [[]];
    for (const term of terms) {
        const next = [];
        for (const left of product)
            for (const right of term) {
                next.push([...left, ...right]);
                if (next.length > MAX_TERMS)
                    return undefined;
            }
        product = next;
    }
    return product;
}
function conjunctionImpossible(atoms) {
    const groups = new Map();
    for (const atom of atoms) {
        const key = `${atom.field}\u0000${atom.value_type}\u0000${atom.unit ?? ''}`;
        for (const prior of atoms)
            if (prior.field === atom.field && (prior.value_type !== atom.value_type || (prior.unit ?? '') !== (atom.unit ?? '')))
                return undefined;
        groups.set(key, [...(groups.get(key) ?? []), atom]);
    }
    for (const constraints of groups.values()) {
        const equal = constraints.filter(x => x.op === 'eq');
        if (equal.some(x => equal.some(y => x.value !== y.value)))
            return true;
        if (equal.length) {
            const v = equal[0].value;
            if (constraints.some(x => x.op === 'ne' && x.value === v || x.op === 'gt' && typeof v === 'number' && v <= Number(x.value) || x.op === 'gte' && typeof v === 'number' && v < Number(x.value) || x.op === 'lt' && typeof v === 'number' && v >= Number(x.value) || x.op === 'lte' && typeof v === 'number' && v > Number(x.value)))
                return true;
        }
        if (constraints.some(x => x.op !== 'eq' && x.op !== 'ne' && x.value_type !== 'number'))
            return undefined;
        if (constraints.every(x => x.value_type === 'number')) {
            let lower = -Infinity, upper = Infinity, lowerOpen = false, upperOpen = false;
            for (const x of constraints) {
                if (x.op === 'gt' || x.op === 'gte') {
                    const n = Number(x.value);
                    if (n > lower) {
                        lower = n;
                        lowerOpen = x.op === 'gt';
                    }
                    else if (n === lower && x.op === 'gt')
                        lowerOpen = true;
                }
                if (x.op === 'lt' || x.op === 'lte') {
                    const n = Number(x.value);
                    if (n < upper) {
                        upper = n;
                        upperOpen = x.op === 'lt';
                    }
                    else if (n === upper && x.op === 'lt')
                        upperOpen = true;
                }
            }
            if (lower > upper || (lower === upper && (lowerOpen || upperOpen)))
                return true;
        }
        if (constraints.every(x => x.value_type === 'string' || x.value_type === 'boolean')) {
            const forbidden = new Set(constraints.filter(x => x.op === 'ne').map(x => String(x.value)));
            const required = constraints.filter(x => x.op === 'eq').map(x => String(x.value));
            if (required.some(v => forbidden.has(v)))
                return true;
        }
    }
    return false;
}
function conditionsDisjoint(left, right) { const a = dnf(left), b = dnf(right); if (!a || !b)
    return 'unknown'; let anyPossible = false; for (const x of a)
    for (const y of b) {
        const impossible = conjunctionImpossible([...x, ...y]);
        if (impossible === undefined)
            return 'unknown';
        if (!impossible)
            anyPossible = true;
    } return anyPossible ? 'possible' : 'disjoint'; }
/** A structural candidate classifier only; it never confirms semantic conflict or chooses priority. */
export function classifyPolicyPair(left, right, exceptionLinked = false) {
    const policy_refs = [left.id, right.id];
    if (left.content_hash === right.content_hash || left.context.trim().toLocaleLowerCase() === right.context.trim().toLocaleLowerCase() && left.actor.trim().toLocaleLowerCase() === right.actor.trim().toLocaleLowerCase() && JSON.stringify(left.condition) === JSON.stringify(right.condition) && left.action.trim().toLocaleLowerCase() === right.action.trim().toLocaleLowerCase() && left.outcome.trim().toLocaleLowerCase() === right.outcome.trim().toLocaleLowerCase())
        return { classification: 'duplicate_candidate', policy_refs, reason: 'Policy claims are structurally identical or near-identical; retain a duplicate review candidate.', overlap: 'possible' };
    if (right.supersedes_policy_ref === left.id || left.supersedes_policy_ref === right.id)
        return { classification: 'replacement_candidate', policy_refs, reason: 'A Policy declares a supersedes reference; replacement meaning still requires review.', overlap: 'unknown' };
    if (exceptionLinked || left.exceptions.length > 0 || right.exceptions.length > 0)
        return { classification: 'explicit_exception_candidate', policy_refs, reason: 'An exception field or Graph relation exists; exception scope and applicability still require review and do not suppress conflict analysis.', overlap: 'unknown' };
    const overlap = conditionsDisjoint(left.condition, right.condition);
    if (overlap === 'disjoint')
        return { classification: 'independent_conditions', policy_refs, reason: 'Supported typed predicates prove the condition sets disjoint; this does not prove broader policy consistency.', overlap };
    if (overlap === 'unknown')
        return { classification: 'inconclusive', policy_refs, reason: 'The bounded condition evaluator cannot establish overlap or disjointness.', overlap };
    return { classification: 'semantic_candidate', policy_refs, reason: 'Conditions may overlap; action/result compatibility and exception scope require semantic review. Overlap alone is not a conflict verdict.', overlap };
}
//# sourceMappingURL=policy-analysis.js.map