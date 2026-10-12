/** Minimal output sink so commands stay testable without capturing stdio. */
export interface Output {
  out(line: string): void;
  err(line: string): void;
}

export const consoleOutput: Output = {
  out(line) {
    process.stdout.write(`${line}\n`);
  },
  err(line) {
    process.stderr.write(`${line}\n`);
  },
};

/** Collects lines in memory. Used by tests. */
export function createMemoryOutput(): Output & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out(line) {
      stdout.push(line);
    },
    err(line) {
      stderr.push(line);
    },
  };
}
