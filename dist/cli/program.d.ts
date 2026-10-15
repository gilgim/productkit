import { Command } from 'commander';
import { type ExitCodeValue } from '../errors.js';
import { type Output } from './output.js';
/**
 * Builds the Commander program.
 *
 * Only implemented commands are registered. A placeholder that accepts input
 * and reports success would misrepresent what the tool can do.
 */
export declare function buildProgram(output?: Output): Command;
/**
 * Parses argv and runs the matching command.
 *
 * Returns an exit code instead of calling process.exit so tests can drive the
 * CLI in-process.
 */
export declare function runCli(argv: string[], output?: Output): Promise<ExitCodeValue>;
