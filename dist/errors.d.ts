/**
 * Exit codes shared by every ProductKit command.
 *
 * The contract is fixed in docs/architecture.md and must not diverge per
 * command. GATE_BLOCKED is unused until the validation gate lands in Change 07;
 * it is declared here so later commands inherit the same meaning.
 */
export declare const ExitCode: {
    /** Normal completion, or a gate that passed. */
    readonly OK: 0;
    /** Validation failed, or the gate blocked the operation. */
    readonly GATE_BLOCKED: 1;
    /** Bad command, bad input, or a filesystem error. */
    readonly USAGE_OR_IO: 2;
};
export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
/**
 * An error that carries the process exit code and a message meant for humans.
 * Thrown by commands, caught once in the CLI entry point.
 */
export declare class CliError extends Error {
    readonly exitCode: ExitCodeValue;
    /** Extra lines printed under the message, e.g. one per conflicting path. */
    readonly details: string[];
    constructor(message: string, exitCode?: ExitCodeValue, details?: string[]);
}
/** Turns an unknown throw into a readable one-line reason. */
export declare function describeCause(cause: unknown): string;
