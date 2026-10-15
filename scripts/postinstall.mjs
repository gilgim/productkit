// Installs the agent skills user-wide after `npm i -g`. Never fails the install.
// Opt out: PRODUCTKIT_SKIP_SKILLS=1
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const bin = fileURLToPath(new URL('../dist/cli/bin.js', import.meta.url));
if (!process.env.PRODUCTKIT_SKIP_SKILLS && existsSync(bin)) {
  try {
    // cwd is set explicitly: npm may run this from a directory that no longer exists.
    spawnSync(process.execPath, [bin, 'install-skills'], { stdio: 'inherit', cwd: path.dirname(bin) });
  } catch {
    // best effort
  }
}
