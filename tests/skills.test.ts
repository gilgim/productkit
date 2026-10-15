// Skills are instructions an agent follows literally, so a command they name
// that the CLI does not have, or a YAML block that does not parse, is a leak:
// the agent guesses. This keeps skill text tied to the real CLI.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import { buildProgram } from '../src/cli/program.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { SKILL_ROOT } from '../src/workspace/skills.js';

function commandNames(): Set<string> {
  const program = buildProgram(createMemoryOutput());
  const names = new Set<string>();
  const walk = (cmd: { name(): string; commands: readonly { name(): string; commands: readonly unknown[] }[] }, prefix: string) => {
    for (const sub of cmd.commands) { const full = `${prefix}${sub.name()}`; names.add(full); walk(sub as never, `${full} `); }
  };
  walk(program as never, '');
  return names;
}

describe('skills stay tied to the CLI', () => {
  it('every `productkit <command>` a skill names exists', async () => {
    const names = commandNames();
    const dirs = (await readdir(SKILL_ROOT, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
    const unknown: string[] = [];
    for (const dir of dirs) {
      const text = await readFile(path.join(SKILL_ROOT, dir, 'SKILL.md'), 'utf8');
      for (const m of text.matchAll(/`productkit ((?:[a-z][a-z-]*)(?: [a-z][a-z-]*)*)/g)) {
        const words = m[1]!.split(' ');
        // Longest prefix that is a command; the rest are arguments/flags.
        let ok = false;
        for (let n = words.length; n >= 1; n--) if (names.has(words.slice(0, n).join(' '))) { ok = true; break; }
        if (!ok) unknown.push(`${dir}: productkit ${m[1]}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('every YAML block in a skill parses', async () => {
    const dirs = (await readdir(SKILL_ROOT, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
    const broken: string[] = [];
    for (const dir of dirs) {
      const text = await readFile(path.join(SKILL_ROOT, dir, 'SKILL.md'), 'utf8');
      for (const m of text.matchAll(/```yaml\n([\s\S]*?)```/g)) {
        try { parseYaml(m[1]!); } catch (e) { broken.push(`${dir}: ${(e as Error).message.split('\n')[0]}`); }
      }
    }
    expect(broken).toEqual([]);
  });

  it('skills never tell the agent to import the package or assemble interpretation entries by hand', async () => {
    const dirs = (await readdir(SKILL_ROOT, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const dir of dirs) {
      const text = await readFile(path.join(SKILL_ROOT, dir, 'SKILL.md'), 'utf8');
      expect(text, dir).not.toMatch(/import\('productkit'\)/);
      expect(text, dir).not.toMatch(/computeEntryHash\(/);
    }
  });
});
