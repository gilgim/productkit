import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  CONFIG_SCHEMA_VERSION,
  STAGE_NAMES,
  initialConfig,
  parseProductConfig,
  productConfigSchema,
} from '../src/schema/config.js';
import { TEMPLATE_ROOT, renderTemplate } from '../src/workspace/templates.js';

const valid = initialConfig('demo', '2026-10-02');

describe('product config schema', () => {
  it('accepts the initial config', () => {
    expect(() => productConfigSchema.parse(valid)).not.toThrow();
  });

  it('starts every stage at not_started', () => {
    for (const stage of STAGE_NAMES) {
      expect(valid.stages[stage], stage).toBe('not_started');
    }
    expect(valid.definition.status).toBe('not_started');
  });

  it('rejects a READY-style stage value', () => {
    const config = { ...valid, stages: { ...valid.stages, discover: 'ready' } };
    expect(() => productConfigSchema.parse(config)).toThrow();
  });

  it('rejects a passed definition status', () => {
    const config = { ...valid, definition: { status: 'passed' } };
    expect(() => productConfigSchema.parse(config)).toThrow();
  });

  it('rejects a missing stage', () => {
    const stages = { ...valid.stages } as Record<string, string>;
    delete stages.export;
    expect(() => productConfigSchema.parse({ ...valid, stages })).toThrow();
  });

  it('rejects an unknown schema_version', () => {
    expect(() => productConfigSchema.parse({ ...valid, schema_version: 7 })).toThrow();
  });

  it('parses both v0 and v1 while preserving their respective stage keys', () => {
    const v0 = {
      ...valid,
      schema_version: 0,
      stages: Object.fromEntries(
        ['ingest', 'discover', 'challenge', 'propose', 'decide', 'define', 'review', 'validate', 'export'].map((key) => [key, 'not_started']),
      ),
    };
    expect(parseProductConfig(JSON.stringify(v0)).schema_version).toBe(0);
    expect(parseProductConfig(JSON.stringify(valid)).schema_version).toBe(1);
  });

  it('rejects a malformed created_at', () => {
    const config = { ...valid, product: { ...valid.product, created_at: '2026/10/02' } };
    expect(() => productConfigSchema.parse(config)).toThrow();
  });

  it('rejects an empty product name', () => {
    const config = { ...valid, product: { ...valid.product, name: '' } };
    expect(() => productConfigSchema.parse(config)).toThrow();
  });
});

describe('config template', () => {
  it('renders to exactly the initial config', async () => {
    const source = await readFile(path.join(TEMPLATE_ROOT, 'product/config.yaml'), 'utf8');
    const rendered = renderTemplate(
      source,
      { product_name: 'demo', created_at: '2026-10-02' },
      'product/config.yaml',
    );
    expect(parseProductConfig(rendered)).toEqual(initialConfig('demo', '2026-10-02'));
  });

  it('records the documented schema version', () => {
    expect(CONFIG_SCHEMA_VERSION).toBe(1);
  });
});
