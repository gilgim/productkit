import type { Output } from '../output.js';
export interface ClarifyOptions {
    prompt?: string | undefined;
    cwd?: string | undefined;
}
export interface ClarifyConfirmOptions {
    prompt?: string | undefined;
    response: 'agreed' | 'disagreed' | 'partially_agreed';
    /** Omit to read the statement from the terminal (required under attestation: tty). */
    userStatement?: string | undefined;
    cwd?: string | undefined;
    now?: Date | undefined;
}
/**
 * Appends one interpretation_check entry. The CLI renders the presentation,
 * computes presented_hash and entry_hash, and — with no --user-statement —
 * reads the user's words from the controlling terminal after printing the
 * rendered block there. The agent never assembles the entry by hand.
 */
export declare function runClarifyConfirm(options: ClarifyConfirmOptions, output: Output): Promise<void>;
export declare function runClarify(options: ClarifyOptions, output: Output): Promise<void>;
