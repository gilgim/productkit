#!/usr/bin/env node
import { ensureGlobalSkills } from './commands/install-skills.js';
import { runCli } from './program.js';
// Self-heal: if npm skipped the postinstall (--ignore-scripts, CI), the first
// run still installs the user-wide skills. Never blocks or fails the command.
// A closed pipe (`productkit ... | head`) is not an error worth a stack trace.
process.stdout.on('error', (e) => { if (e.code === 'EPIPE')
    process.exit(0); throw e; });
await ensureGlobalSkills();
process.exitCode = await runCli(process.argv.slice(2));
//# sourceMappingURL=bin.js.map