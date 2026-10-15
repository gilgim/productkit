import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { parseProductConfig } from '../src/schema/config.js';
import { buildInitPlan } from '../src/workspace/plan.js';
import { AGENT_SKILL_DIRS, SKILL_NAMES } from '../src/workspace/skills.js';

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..');

let workDir: string;
let tarball: string;
let tarEntries: string[];

/**
 * Packs the real tarball once and installs it outside the repository, so the
 * tests below exercise what a user actually gets.
 */
beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), 'productkit-pack-'));

  const { stdout } = await run('npm', ['pack', '--json', '--pack-destination', workDir], {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  const packed = JSON.parse(stdout) as Array<{ filename: string; files: Array<{ path: string }> }>;
  const first = packed[0];
  if (!first) throw new Error('npm pack produced no tarball');

  tarball = path.join(workDir, first.filename);
  tarEntries = first.files.map((file) => file.path);
}, 300_000);

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('npm package contents', () => {
  it('includes the compiled CLI', () => {
    expect(tarEntries).toContain('dist/cli/bin.js');
  });

  it('includes every init template', () => {
    const templates = tarEntries.filter((entry) => entry.startsWith('templates/'));
    expect(templates).toContain('templates/product/config.yaml');
    expect(templates).toContain('templates/product/constitution.md');
    expect(templates).toContain('templates/product/overview.md');
    expect(templates).toContain('templates/product/decisions/README.md');
    expect(templates).toContain('templates/product/graph/README.md');
    expect(templates.length).toBe(14);
  });

  it('includes every agent skill', () => {
    for (const name of SKILL_NAMES) {
      expect(tarEntries, name).toContain(`skills/${name}/SKILL.md`);
    }
  });

  it('does not ship tests or openspec artifacts', () => {
    expect(tarEntries.some((entry) => entry.startsWith('tests/'))).toBe(false);
    expect(tarEntries.some((entry) => entry.startsWith('openspec/'))).toBe(false);
  });
});

describe('installed CLI outside the repository', () => {
  let consumer: string;

  beforeAll(async () => {
    consumer = path.join(workDir, 'consumer');
    await run('npm', ['init', '-y'], { cwd: workDir });
    await run('mkdir', ['-p', consumer]);
    await run('npm', ['install', '--no-save', '--silent', tarball], { cwd: workDir });
  }, 300_000);

  it('reports its version', async () => {
    const { stdout } = await run(path.join(workDir, 'node_modules/.bin/productkit'), [
      '--version',
    ]);
    const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8')) as {
      version: string;
    };
    expect(stdout.trim()).toBe(pkg.version);
  });

  it('initialises a workspace outside the repository', async () => {
    const { stdout } = await run(
      path.join(workDir, 'node_modules/.bin/productkit'),
      ['init', consumer],
      { cwd: workDir },
    );

    expect(stdout).toContain(`${buildInitPlan().length} created`);
    const config = await readFile(path.join(consumer, 'product', 'config.yaml'), 'utf8');
    expect(parseProductConfig(config).definition.status).toBe('not_started');
    const dir = await stat(path.join(consumer, 'product', 'decisions'));
    expect(dir.isDirectory()).toBe(true);
  }, 60_000);

  it('does not install OpenSpec into the ProductKit runtime and keeps export approval-gated', async () => {
    await expect(stat(path.join(workDir, 'node_modules/@fission-ai/openspec/bin/openspec.js'))).rejects.toMatchObject({ code: 'ENOENT' });
    const { stdout } = await run(path.join(workDir, 'node_modules/.bin/productkit'), ['--help'], { cwd: workDir });
    expect(stdout).toContain('export');
    const result = await run(path.join(workDir, 'node_modules/.bin/productkit'), ['export', 'openspec', '--change', 'unapproved-test'], { cwd: consumer }).catch((error: unknown) => error as { code?: number; stderr?: string });
    expect(result).toMatchObject({ code: 1 });
    expect((result as { stderr?: string }).stderr).toContain('Product Definition is missing');
    await expect(stat(path.join(consumer, 'openspec/changes/unapproved-test'))).rejects.toMatchObject({ code: 'ENOENT' });
  }, 60_000);
});
