export const consoleOutput = {
    out(line) {
        process.stdout.write(`${line}\n`);
    },
    err(line) {
        process.stderr.write(`${line}\n`);
    },
};
/** Collects lines in memory. Used by tests. */
export function createMemoryOutput() {
    const stdout = [];
    const stderr = [];
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
//# sourceMappingURL=output.js.map