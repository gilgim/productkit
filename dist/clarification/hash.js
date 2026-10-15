import { createHash } from 'node:crypto';
/**
 * Recursively sorts object keys so the same data always serializes the same
 * way, regardless of insertion order. Arrays keep their order — order is
 * meaningful there (e.g. decomposition sequence).
 */
function canonicalize(value) {
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }
    if (value !== null && typeof value === 'object') {
        const source = value;
        const sorted = {};
        for (const key of Object.keys(source).sort()) {
            sorted[key] = canonicalize(source[key]);
        }
        return sorted;
    }
    return value;
}
/** Canonical JSON: same data in, same string out, independent of key order. */
export function canonicalJson(value) {
    return JSON.stringify(canonicalize(value));
}
export function sha256Hex(text) {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}
//# sourceMappingURL=hash.js.map