import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Package version read at runtime.
 *
 * Both src/version.ts and dist/version.js sit one level below the package
 * root, so the same relative path works in development and when installed.
 */
export const VERSION: string = (require('../package.json') as { version: string }).version;
