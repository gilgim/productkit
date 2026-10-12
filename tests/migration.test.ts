import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { migrateWorkspace } from '../src/clarification/migration.js';

const v0 = `# keep this comment\nschema_version: 0\nproduct:\n  name: legacy\n  created_at: "2026-10-01"\nstages:\n  ingest: done\n  discover: in_progress\n  challenge: not_started\n  propose: done\n  decide: in_progress\n  define: not_started\n  review: done\n  validate: not_started\n  export: not_started\n  custom_stage: done\ncustom: keep-me\ndefinition:\n  status: draft\n`;
let root = '';
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });

async function workspace(text = v0) {
  root = await mkdtemp(path.join(tmpdir(), 'productkit-migration-'));
  const product = path.join(root, 'product');
  await mkdir(product);
  await writeFile(path.join(product, 'config.yaml'), text);
  await mkdir(path.join(product, 'sources'));
  await writeFile(path.join(product, 'sources', 'user.yaml'), 'keep exactly\n');
  return product;
}

describe('explicit config migration', () => {
  it('preserves the v0 source and all existing values while adding v1 stages', async () => {
    const product = await workspace();
    const result = await migrateWorkspace(product);
    const after = await readFile(path.join(product, 'config.yaml'), 'utf8');
    expect(result.state).toBe('committed');
    expect(after).toContain('schema_version: 1');
    expect(after).toContain('custom_stage: done');
    expect(after).toContain('custom: keep-me');
    expect(after).toContain('# keep this comment');
    expect(await readFile(path.join(product, 'config.yaml.v0.bak'), 'utf8')).toBe(v0);
    expect(await readFile(path.join(product, 'sources/user.yaml'), 'utf8')).toBe('keep exactly\n');
  });

  it('is safe to repeat after commit', async () => {
    const product = await workspace();
    await migrateWorkspace(product);
    const before = await readFile(path.join(product, 'config.yaml.v0.bak'), 'utf8');
    expect((await migrateWorkspace(product)).state).toBe('already_current');
    expect(await readFile(path.join(product, 'config.yaml.v0.bak'), 'utf8')).toBe(before);
  });

  it('supports dry-run without creating journal or backup', async () => {
    const product = await workspace();
    expect((await migrateWorkspace(product, { dryRun: true })).state).toBe('dry_run');
    await expect(readFile(path.join(product, 'config.yaml.v0.bak'))).rejects.toThrow();
  });

  it('recovers a crash after backup publication without a journal', async () => {
    const product = await workspace();
    await expect(migrateWorkspace(product, { interruptAt: 'backup_published' })).rejects.toThrow('Simulated process interruption');
    await writeFile(path.join(product, '.migration-v0-v1.lock'), '99999999\ncrashed\n');
    await writeFile(path.join(product, '.config.lock'), '99999999\ncrashed\n');
    expect((await migrateWorkspace(product, { resume: true })).state).toBe('resumed');
    expect((await readFile(path.join(product, 'config.yaml'), 'utf8'))).toContain('schema_version: 1');
  });

  it('resumes after config replacement and commits the journal', async () => {
    const product = await workspace();
    await expect(migrateWorkspace(product, { interruptAt: 'config_replaced' })).rejects.toThrow('Simulated process interruption');
    await writeFile(path.join(product, '.migration-v0-v1.lock'), '99999999\ncrashed\n');
    await writeFile(path.join(product, '.config.lock'), '99999999\ncrashed\n');
    expect((await migrateWorkspace(product, { resume: true })).state).toBe('resumed');
    const journal = JSON.parse(await readFile(path.join(product, '.migration-v0-v1.json'), 'utf8')) as { state: string };
    expect(journal.state).toBe('committed');
  });

  it('rolls back from a verified backup and is safe to repeat', async () => {
    const product = await workspace();
    await migrateWorkspace(product);
    expect((await migrateWorkspace(product, { rollback: true })).state).toBe('rolled_back');
    expect(await readFile(path.join(product, 'config.yaml'), 'utf8')).toBe(v0);
    expect((await migrateWorkspace(product, { rollback: true })).state).toBe('already_rolled_back');
  });

  it('refuses rollback after a user edits the migrated config', async () => {
    const product = await workspace();
    await migrateWorkspace(product);
    const file = path.join(product, 'config.yaml');
    await writeFile(file, (await readFile(file, 'utf8')) + '\nuser_note: keep\n');
    const before = await readFile(file, 'utf8');
    await expect(migrateWorkspace(product, { rollback: true })).rejects.toThrow('rollback refused');
    expect(await readFile(file, 'utf8')).toBe(before);
  });

  it('preserves config and conflicting backup when backup does not match source', async () => {
    const product = await workspace();
    const backup = path.join(product, 'config.yaml.v0.bak');
    await writeFile(backup, 'foreign backup\n');
    await expect(migrateWorkspace(product)).rejects.toThrow('Existing backup differs');
    expect(await readFile(path.join(product, 'config.yaml'), 'utf8')).toBe(v0);
    expect(await readFile(backup, 'utf8')).toBe('foreign backup\n');
  });

  it('refuses stage-key collisions without changing config', async () => {
    const product = await workspace(v0.replace('  challenge:', '  atomic_modeling: done\n  challenge:'));
    await expect(migrateWorkspace(product)).rejects.toThrow('conflicts with a v1 stage key');
    expect(await readFile(path.join(product, 'config.yaml'), 'utf8')).toContain('atomic_modeling: done');
  });

  it('preserves v0 when backup, target write, or rename fails', async () => {
    for (const failAt of ['backup_publish', 'target_write', 'config_replace'] as const) {
      const product = await workspace();
      await expect(migrateWorkspace(product, { failAt })).rejects.toThrow('Injected I/O failure');
      expect(await readFile(path.join(product, 'config.yaml'), 'utf8')).toBe(v0);
      await rm(root, { recursive: true, force: true });
    }
    root = '';
  });

  it('recovers journal write failures at either side of the config commit', async () => {
    for (const failAt of ['journal_prepare', 'journal_commit'] as const) {
      const product = await workspace();
      await expect(migrateWorkspace(product, { failAt })).rejects.toThrow('Injected I/O failure');
      const config = await readFile(path.join(product, 'config.yaml'), 'utf8');
      if (failAt === 'journal_prepare') expect(config).toBe(v0);
      else expect(config).toContain('schema_version: 1');
      expect((await migrateWorkspace(product, { resume: true })).state).toBe('resumed');
      await rm(root, { recursive: true, force: true });
    }
    root = '';
  });
});
