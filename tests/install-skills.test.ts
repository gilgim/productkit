import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runInstallSkills } from '../src/cli/commands/install-skills.js';
import { SKILL_NAMES, installedSkillName } from '../src/workspace/skills.js';

const quiet = { out: () => {}, err: () => {} } as never;

describe('install-skills', () => {
  it('installs every skill for both agents and is idempotent', async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), 'pk-home-'));
    await runInstallSkills({ home }, quiet);
    for (const dir of ['.claude/skills', '.agents/skills']) {
      for (const name of SKILL_NAMES) {
        const text = await readFile(path.join(home, dir, installedSkillName(name), 'SKILL.md'), 'utf8');
        expect(text, name).toMatch(new RegExp(`^---\\nname: ${installedSkillName(name)}\\n`));
      }
    }
    await runInstallSkills({ home }, quiet);
  });
});
