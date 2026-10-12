import { describe, expect, it } from 'vitest';
import { access } from 'node:fs/promises';
import path from 'node:path';

import { TEMPLATE_ROOT, loadTemplate, renderTemplate } from '../src/workspace/templates.js';
import { buildInitPlan } from '../src/workspace/plan.js';
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
      if (entry.kind !== 'file') continue;
      await expect(
        access(path.join(TEMPLATE_ROOT, entry.template)),
        entry.template,
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

  it('writes only inside product/', () => {
    for (const entry of buildInitPlan()) {
      expect(entry.relativePath === 'product' || entry.relativePath.startsWith('product/')).toBe(
        true,
      );
    }
  });

  it('renders every planned template with the init variables', async () => {
    for (const entry of buildInitPlan()) {
      if (entry.kind !== 'file') continue;
      const rendered = await loadTemplate(entry.template, {
        product_name: 'demo',
        created_at: '2026-10-02',
      });
      expect(rendered.length, entry.template).toBeGreaterThan(0);
    }
  });
});
