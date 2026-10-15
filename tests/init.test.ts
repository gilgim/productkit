import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runInit } from '../src/cli/commands/init.js';
import { createMemoryOutput } from '../src/cli/output.js';
import { CliError, ExitCode } from '../src/errors.js';
import { parseProductConfig } from '../src/schema/config.js';
import { ARTIFACT_DIRS, buildInitPlan } from '../src/workspace/plan.js';
import { AGENT_SKILL_DIRS, SKILL_NAMES, installedSkillName, loadSkillFile } from '../src/workspace/skills.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'productkit-init-'));
});

afterEach(async () => {
  await chmod(root, 0o755).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
});

async function init(targetPath: string, extra: Record<string, unknown> = {}) {
  const output = createMemoryOutput();
  await runInit(
    { targetPath, now: new Date('2026-10-02T12:00:00'), cwd: root, ...extra },
    output,
  );
  return output;
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

describe('init on an empty directory', () => {
  it('creates the whole workspace and reports it', async () => {
    const target = path.join(root, 'app');
    await mkdir(target);
    const output = await init(target);

    for (const entry of buildInitPlan()) {
      expect(await exists(path.join(target, entry.relativePath)), entry.relativePath).toBe(
        true,
      );
    }
    expect(output.stdout.join('\n')).toContain('0 skipped, 0 conflicts');
  });

  it('creates every artifact directory', async () => {
    const target = path.join(root, 'app');
    const output = await init(target);
    for (const dir of ARTIFACT_DIRS) {
      const info = await stat(path.join(target, 'product', dir));
      expect(info.isDirectory(), dir).toBe(true);
    }
    expect(output.stdout.join('\n')).toContain(`${buildInitPlan().length} created`);
  });

  it('creates the target directory when it does not exist yet', async () => {
    const target = path.join(root, 'nested', 'app');
    await init(target);
    expect(await exists(path.join(target, 'product', 'config.yaml'))).toBe(true);
  });

  it('defaults to the current working directory when no path is given', async () => {
    const output = createMemoryOutput();
    await runInit({ cwd: root, now: new Date('2026-10-02T12:00:00') }, output);
    expect(await exists(path.join(root, 'product', 'config.yaml'))).toBe(true);
  });

  it('handles a path containing spaces', async () => {
    const target = path.join(root, 'my app');
    await init(target);
    const config = await readFile(path.join(target, 'product', 'config.yaml'), 'utf8');
    expect(parseProductConfig(config).product.name).toBe('my app');
  });
});

describe('generated config', () => {
  it('passes schema validation and starts not_started', async () => {
    const target = path.join(root, 'app');
    await init(target);
    const config = parseProductConfig(
      await readFile(path.join(target, 'product', 'config.yaml'), 'utf8'),
    );

    expect(config.schema_version).toBe(1);
    expect(config.product.created_at).toBe('2026-10-02');
    expect(config.definition.status).toBe('not_started');
    for (const [stage, status] of Object.entries(config.stages)) {
      expect(status, stage).toBe('not_started');
    }
  });

  it('never writes READY or PASS', async () => {
    const target = path.join(root, 'app');
    await init(target);
    const config = await readFile(path.join(target, 'product', 'config.yaml'), 'utf8');
    expect(config).not.toMatch(/\b(READY|PASS|ready|passed|complete)\b/);
  });

  it('uses --name when given', async () => {
    const target = path.join(root, 'app');
    await init(target, { name: 'Workout Tracker' });
    const config = parseProductConfig(
      await readFile(path.join(target, 'product', 'config.yaml'), 'utf8'),
    );
    expect(config.product.name).toBe('Workout Tracker');
  });
});

describe('init never overwrites', () => {
  it('preserves edited files on a second run', async () => {
    const target = path.join(root, 'app');
    await init(target);

    const constitution = path.join(target, 'product', 'constitution.md');
    await writeFile(constitution, 'MY OWN RULES\n', 'utf8');

    const output = await init(target);

    expect(await readFile(constitution, 'utf8')).toBe('MY OWN RULES\n');
    expect(output.stdout.join('\n')).toContain(`0 created, ${buildInitPlan().length} skipped, 0 conflicts`);
    expect(output.stdout.join('\n')).toContain('left untouched');
  });

  it('creates only the missing files in a partial workspace', async () => {
    const target = path.join(root, 'app');
    await mkdir(path.join(target, 'product'), { recursive: true });
    await writeFile(path.join(target, 'product', 'config.yaml'), 'hand written\n', 'utf8');

    const output = await init(target);

    expect(await readFile(path.join(target, 'product', 'config.yaml'), 'utf8')).toBe(
      'hand written\n',
    );
    expect(await exists(path.join(target, 'product', 'overview.md'))).toBe(true);
    expect(output.stdout.join('\n')).toContain(`${buildInitPlan().length - 2} created, 2 skipped, 0 conflicts`);
  });

  it('writes nothing in --dry-run', async () => {
    const target = path.join(root, 'app');
    const output = await init(target, { dryRun: true });
    expect(await exists(path.join(target, 'product'))).toBe(false);
    expect(output.stdout.join('\n')).toContain('would create');
    expect(output.stdout.join('\n')).toContain(`${buildInitPlan().length} to create`);
  });
});

describe('structural conflicts', () => {
  it('refuses when a directory sits where a file belongs', async () => {
    const target = path.join(root, 'app');
    await mkdir(path.join(target, 'product', 'config.yaml'), { recursive: true });

    const error = await init(target).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CliError);
    const cliError = error as CliError;
    expect(cliError.exitCode).toBe(ExitCode.USAGE_OR_IO);
    expect(cliError.details.join('\n')).toContain('product/config.yaml');
    expect(cliError.details.join('\n')).toContain('expected a file, found a dir');
    // Nothing else was written.
    expect(await exists(path.join(target, 'product', 'overview.md'))).toBe(false);
  });

  it('refuses when a file sits where a directory belongs', async () => {
    const target = path.join(root, 'app');
    await mkdir(path.join(target, 'product'), { recursive: true });
    await writeFile(path.join(target, 'product', 'sources'), 'not a directory\n', 'utf8');

    const error = (await init(target).catch((caught: unknown) => caught)) as CliError;

    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
    expect(error.details.join('\n')).toContain('expected a dir, found a file');
    expect(await exists(path.join(target, 'product', 'overview.md'))).toBe(false);
  });

  it('reports every conflict at once', async () => {
    const target = path.join(root, 'app');
    await mkdir(path.join(target, 'product', 'config.yaml'), { recursive: true });
    await writeFile(path.join(target, 'product', 'sources'), 'x\n', 'utf8');

    const error = (await init(target).catch((caught: unknown) => caught)) as CliError;
    expect(error.message).toContain('2 path conflict(s)');
    expect(error.message).toContain('Nothing was written');
  });

  it('refuses when the target path is a regular file', async () => {
    const target = path.join(root, 'a-file');
    await writeFile(target, 'x\n', 'utf8');

    const error = (await init(target).catch((caught: unknown) => caught)) as CliError;

    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
    expect(error.message).toContain('not a directory');
  });
});

describe('write failures', () => {
  it('reports the path and the reason', async () => {
    const target = path.join(root, 'readonly');
    await mkdir(target);
    await chmod(target, 0o500);

    const error = (await init(target).catch((caught: unknown) => caught)) as CliError;

    await chmod(target, 0o700);

    expect(error).toBeInstanceOf(CliError);
    expect(error.exitCode).toBe(ExitCode.USAGE_OR_IO);
    expect(error.message).toContain('product');
    expect(error.message).toMatch(/EACCES|permission/i);
  });
});

describe('init stays inside product/', () => {
  it('leaves CLAUDE.md, AGENTS.md and openspec/ alone', async () => {
    const target = path.join(root, 'app');
    await mkdir(path.join(target, 'openspec', 'changes'), { recursive: true });
    await writeFile(path.join(target, 'CLAUDE.md'), 'project rules\n', 'utf8');
    await writeFile(path.join(target, 'AGENTS.md'), 'agent rules\n', 'utf8');
    await writeFile(path.join(target, 'openspec', 'config.yaml'), 'schema: x\n', 'utf8');

    await init(target);

    expect(await readFile(path.join(target, 'CLAUDE.md'), 'utf8')).toBe('project rules\n');
    expect(await readFile(path.join(target, 'AGENTS.md'), 'utf8')).toBe('agent rules\n');
    expect(await readFile(path.join(target, 'openspec', 'config.yaml'), 'utf8')).toBe(
      'schema: x\n',
    );
  });

  it('creates no artifact files, only guidance READMEs', async () => {
    const target = path.join(root, 'app');
    await init(target);

    const { readdir } = await import('node:fs/promises');
    for (const dir of ARTIFACT_DIRS) {
      const files = await readdir(path.join(target, 'product', dir));
      expect(files, dir).toEqual(['README.md']);
    }
  });
});

describe('init installs the agent skills', () => {
  it('writes every skill into every agent directory', async () => {
    const target = path.join(root, 'app');
    await init(target);

    for (const agentDir of AGENT_SKILL_DIRS) {
      for (const name of SKILL_NAMES) {
        const written = await readFile(
          path.join(target, agentDir, installedSkillName(name), 'SKILL.md'),
          'utf8',
        );
        expect(written, `${agentDir}/${name}`).toBe(await loadSkillFile(`${name}/SKILL.md`));
      }
    }
  });

  it('tells the user the agent must be restarted', async () => {
    const output = await init(path.join(root, 'app'));
    expect(output.stdout.join('\n')).toMatch(/Restart Claude Code or Codex/);
  });

  it('writes no agent directory when --no-skills is given', async () => {
    const target = path.join(root, 'app');
    await init(target, { skills: false });

    expect(await exists(path.join(target, 'product', 'config.yaml'))).toBe(true);
    for (const agentDir of AGENT_SKILL_DIRS) {
      expect(await exists(path.join(target, agentDir)), agentDir).toBe(false);
    }
  });

  it('leaves an edited skill alone on a second run', async () => {
    const target = path.join(root, 'app');
    await init(target);
    const skillPath = path.join(target, '.claude', 'skills', 'productkit-clarify', 'SKILL.md');
    await writeFile(skillPath, 'edited by the user', 'utf8');

    await init(target);
    expect(await readFile(skillPath, 'utf8')).toBe('edited by the user');
  });
});
