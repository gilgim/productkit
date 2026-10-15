#!/usr/bin/env node
import { ensureGlobalSkills } from './commands/install-skills.js';
import { runCli } from './program.js';

// Self-heal: if npm skipped the postinstall (--ignore-scripts, CI), the first
// run still installs the user-wide skills. Never blocks or fails the command.
await ensureGlobalSkills();

process.exitCode = await runCli(process.argv.slice(2));
