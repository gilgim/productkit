import { describe, expect, it } from 'vitest';
import { access } from 'node:fs/promises';
import path from 'node:path';

import { TEMPLATE_ROOT, loadTemplate, renderTemplate } from '../src/workspace/templates.js';
import { buildInitPlan } from '../src/workspace/plan.js';
import {
  AGENT_SKILL_DIRS,
  SKILL_NAMES,
  SKILL_ROOT,
  loadSkillFile,
} from '../src/workspace/skills.js';
import { CliError } from '../src/errors.js';

describe('renderTemplate', () => {
  it('substitutes known placeholders', () => {
    expect(renderTemplate('hi {{name}}', { name: 'bo' }, 't')).toBe('hi bo');
  });

  it('throws on an unknown placeholder rather than blanking it', () => {
    expect(() => renderTemplate('hi {{nope}}', {}, 't')).toThrow(CliError);
    expect(() => renderTemplate('hi {{nope}}', {}, 't')).toThrow(/nope/);
  });

  it('leaves text without placeholders unchanged', () => {
    expect(renderTemplate('plain text', {}, 't')).toBe('plain text');
  });
});

describe('loadTemplate', () => {
  it('reports a missing template with its path', async () => {
    await expect(loadTemplate('product/does-not-exist.md', {})).rejects.toThrow(CliError);
  });
});

describe('init plan', () => {
  it('has a template file on disk for every planned file', async () => {
    for (const entry of buildInitPlan()) {
      if (entry.kind !== 'file' || entry.source.from !== 'template') continue;
      await expect(
        access(path.join(TEMPLATE_ROOT, entry.source.path)),
        entry.source.path,
      ).resolves.toBeUndefined();
    }
  });

  it('lists each directory before its contents', () => {
    const seen = new Set<string>();
    for (const entry of buildInitPlan()) {
      const parent = path.posix.dirname(entry.relativePath);
      if (parent !== '.') {
        expect(seen.has(parent), `${entry.relativePath} before ${parent}`).toBe(true);
      }
      seen.add(entry.relativePath);
    }
  });

  it('writes only inside product/ when skills are skipped', () => {
    for (const entry of buildInitPlan({ skills: false })) {
      expect(entry.relativePath === 'product' || entry.relativePath.startsWith('product/')).toBe(
        true,
      );
    }
  });

  it('writes only inside product/ and the agent skill directories', () => {
    const allowed = ['product', ...AGENT_SKILL_DIRS.map((d) => d.slice(0, d.indexOf('/')))];
    for (const entry of buildInitPlan()) {
      const root = entry.relativePath.split('/')[0];
      expect(allowed, entry.relativePath).toContain(root);
    }
  });

  it('has a skill file on disk for every planned skill', async () => {
    for (const entry of buildInitPlan()) {
      if (entry.kind !== 'file' || entry.source.from !== 'skill') continue;
      await expect(
        access(path.join(SKILL_ROOT, entry.source.path)),
        entry.source.path,
      ).resolves.toBeUndefined();
    }
  });

  it('plans one SKILL.md per skill per agent directory', () => {
    const skillFiles = buildInitPlan().filter(
      (entry) => entry.kind === 'file' && entry.source.from === 'skill',
    );
    expect(skillFiles.length).toBe(SKILL_NAMES.length * AGENT_SKILL_DIRS.length);
  });

  it('leaves skill files untouched by template rendering', async () => {
    const source = await loadSkillFile('clarify/SKILL.md');
    expect(source.length).toBeGreaterThan(0);
  });

  it('renders every planned template with the init variables', async () => {
    for (const entry of buildInitPlan()) {
      if (entry.kind !== 'file' || entry.source.from !== 'template') continue;
      const rendered = await loadTemplate(entry.source.path, {
        product_name: 'demo',
        created_at: '2026-10-02',
      });
      expect(rendered.length, entry.source.path).toBeGreaterThan(0);
    }
  });
});
