import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CliError, describeCause } from '../errors.js';
/**
 * Template root.
 *
 * src/workspace/ and dist/workspace/ both sit two levels below the package
 * root, so this resolves to <package>/templates in development and after an
 * npm install. templates/ ships via the `files` field in package.json.
 */
export const TEMPLATE_ROOT = fileURLToPath(new URL('../../templates/', import.meta.url));
const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;
/**
 * Replaces {{key}} placeholders.
 *
 * An unknown key is an error rather than an empty string: silently blanking it
 * would let a template typo reach the generated workspace.
 */
export function renderTemplate(source, vars, templateName) {
    const missing = new Set();
    const rendered = source.replace(PLACEHOLDER, (match, key) => {
        const value = vars[key];
        if (value === undefined) {
            missing.add(key);
            return match;
        }
        return value;
    });
    if (missing.size > 0) {
        throw new CliError(`Template "${templateName}" uses unknown placeholders: ${[...missing].sort().join(', ')}`);
    }
    return rendered;
}
/** Reads a template relative to TEMPLATE_ROOT and renders it. */
export async function loadTemplate(relativePath, vars) {
    const absolute = path.join(TEMPLATE_ROOT, relativePath);
    let source;
    try {
        source = await readFile(absolute, 'utf8');
    }
    catch (cause) {
        throw new CliError(`Could not read template "${relativePath}" at ${absolute}: ${describeCause(cause)}`);
    }
    return renderTemplate(source, vars, relativePath);
}
//# sourceMappingURL=templates.js.map