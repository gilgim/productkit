/**
 * Exit codes shared by every ProductKit command.
 *
 * The contract is fixed in docs/architecture.md and must not diverge per
 * command. GATE_BLOCKED is unused until the validation gate lands in Change 07;
 * it is declared here so later commands inherit the same meaning.
 */
export const ExitCode = {
  /** Normal completion, or a gate that passed. */
  OK: 0,
  /** Validation failed, or the gate blocked the operation. */
  GATE_BLOCKED: 1,
  /** Bad command, bad input, or a filesystem error. */
  USAGE_OR_IO: 2,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * An error that carries the process exit code and a message meant for humans.
 * Thrown by commands, caught once in the CLI entry point.
 */
export class CliError extends Error {
  readonly exitCode: ExitCodeValue;
  /** Extra lines printed under the message, e.g. one per conflicting path. */
  readonly details: string[];

  constructor(
    message: string,
    exitCode: ExitCodeValue = ExitCode.USAGE_OR_IO,
    details: string[] = [],
  ) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
    this.details = details;
  }
}

/** Turns an unknown throw into a readable one-line reason. */
export function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code;
    return code ? `${cause.message} (${code})` : cause.message;
  }
  return String(cause);
}
