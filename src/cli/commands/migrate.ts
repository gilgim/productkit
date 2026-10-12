import path from 'node:path';
import type { Command } from 'commander';
import { CliError, ExitCode } from '../../errors.js';
import { migrateWorkspace } from '../../clarification/migration.js';
import type { Output } from '../output.js';

export async function runMigrate(options: { cwd?: string; dryRun?: boolean; resume?: boolean; rollback?: boolean }, output: Output): Promise<void> {
  const productRoot = path.join(options.cwd ?? process.cwd(), 'product');
  const result = await migrateWorkspace(productRoot, options);
  output.out(`Migration: ${result.state}`);
  output.out(`Backup: ${path.relative(options.cwd ?? process.cwd(), result.backup_path)}`);
  if (result.source_hash) output.out(`Source SHA-256: ${result.source_hash}`);
  if (result.target_hash) output.out(`Target SHA-256: ${result.target_hash}`);
  for (const step of result.plan ?? []) output.out(`  ${step}`);
  if (result.state === 'dry_run') output.out('Dry run made no changes.');
  if (result.state === 'committed' || result.state === 'resumed') output.out('Existing artifact files were not changed.');
}

export function registerMigrateCommand(program: Command, output: Output): void {
  program.command('migrate')
    .description('explicitly migrate a ProductKit workspace config from schema v0 to v1')
    .option('--dry-run', 'show the migration plan without writing')
    .option('--resume', 'resume a verified interrupted migration')
    .option('--rollback', 'restore the verified v0 backup when config has not changed')
    .action(async (options: { dryRun?: boolean; resume?: boolean; rollback?: boolean }) => {
      if (Number(Boolean(options.dryRun)) + Number(Boolean(options.resume)) + Number(Boolean(options.rollback)) > 1) throw new CliError('Choose only one migration mode.', ExitCode.USAGE_OR_IO);
      await runMigrate(options, output);
    });
}
