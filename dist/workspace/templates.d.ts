/**
 * Template root.
 *
 * src/workspace/ and dist/workspace/ both sit two levels below the package
 * root, so this resolves to <package>/templates in development and after an
 * npm install. templates/ ships via the `files` field in package.json.
 */
export declare const TEMPLATE_ROOT: string;
export type TemplateVars = Record<string, string>;
/**
 * Replaces {{key}} placeholders.
 *
 * An unknown key is an error rather than an empty string: silently blanking it
 * would let a template typo reach the generated workspace.
 */
export declare function renderTemplate(source: string, vars: TemplateVars, templateName: string): string;
/** Reads a template relative to TEMPLATE_ROOT and renders it. */
export declare function loadTemplate(relativePath: string, vars: TemplateVars): Promise<string>;
