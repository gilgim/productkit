/** Minimal output sink so commands stay testable without capturing stdio. */
export interface Output {
    out(line: string): void;
    err(line: string): void;
}
export declare const consoleOutput: Output;
/** Collects lines in memory. Used by tests. */
export declare function createMemoryOutput(): Output & {
    stdout: string[];
    stderr: string[];
};
