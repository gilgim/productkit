#!/usr/bin/env node
import { ensureGlobalSkills } from './commands/install-skills.js';
import { runCli } from './program.js';
// Every run makes sure the user-wide skills exist and match this version.
// Done here, not in an npm lifecycle script: a global git install runs
// postinstall in places where the package files are not there yet.
// Never blocks or fails the command.
// A closed pipe (`productkit ... | head`) is not an error worth a stack trace.
process.stdout.on('error', (e) => { if (e.code === 'EPIPE')
    process.exit(0); throw e; });
await ensureGlobalSkills();
process.exitCode = await runCli(process.argv.slice(2));
//# sourceMappingURL=bin.js.map