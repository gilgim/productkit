// Installs the agent skills user-wide after `npm i -g`. Never fails the install.
// Opt out: PRODUCTKIT_SKIP_SKILLS=1
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../dist/cli/bin.js', import.meta.url));
if (!process.env.PRODUCTKIT_SKIP_SKILLS && existsSync(bin)) {
  try {
    spawnSync(process.execPath, [bin, 'install-skills'], { stdio: 'inherit' });
  } catch {
    // best effort
  }
}
