import path from 'node:path';

import { CliError, ExitCode } from '../../errors.js';
import { WORKSPACE_DIR } from '../../workspace/plan.js';
import { scaffoldWorkspace } from '../../workspace/scaffold.js';
import type { Output } from '../output.js';

export interface InitOptions {
  /** Target directory. Defaults to the current working directory. */
  targetPath?: string | undefined;
  /** Product name written into config.yaml. Defaults to the directory name. */
  name?: string | undefined;
  dryRun?: boolean | undefined;
  /** Injected for tests; defaults to the real clock. */
  now?: Date | undefined;
  cwd?: string | undefined;
}

/** Local calendar date as YYYY-MM-DD. */
function isoDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultProductName(targetRoot: string): string {
  const base = path.basename(targetRoot);
  return base.length > 0 ? base : 'product';
}

export async function runInit(options: InitOptions, output: Output): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const targetRoot = path.resolve(cwd, options.targetPath ?? '.');
  const productName = options.name ?? defaultProductName(targetRoot);

  const result = await scaffoldWorkspace({
    targetRoot,
    dryRun: options.dryRun ?? false,
    vars: {
      product_name: productName,
      created_at: isoDate(options.now ?? new Date()),
    },
  });

  if (result.conflicts.length > 0) {
    const details = result.conflicts.map(
      (conflict) =>
        `  ${conflict.relativePath} — expected a ${conflict.expected}, found a ${conflict.found}`,
    );
    throw new CliError(
      `Cannot initialise ${targetRoot}: ${result.conflicts.length} path conflict(s). Nothing was written.`,
      ExitCode.USAGE_OR_IO,
      [
        ...details,
        '',
        'Rename or remove the conflicting paths, then run init again.',
      ],
    );
  }

  const created = result.entries.filter((entry) => entry.action === 'created');
  const skipped = result.entries.filter((entry) => entry.action === 'skipped');

  const prefix = result.dryRun ? 'would create' : 'created';
  output.out(`ProductKit workspace: ${path.join(targetRoot, WORKSPACE_DIR)}`);
  output.out('');

  for (const entry of result.entries) {
    const mark = entry.action === 'created' ? prefix : 'skipped (exists)';
    const suffix = entry.kind === 'dir' ? '/' : '';
    output.out(`  ${mark.padEnd(16)} ${entry.relativePath}${suffix}`);
  }

  output.out('');
  output.out(
    `${created.length} ${result.dryRun ? 'to create' : 'created'}, ${skipped.length} skipped, 0 conflicts`,
  );

  if (skipped.length > 0) {
    output.out('');
    output.out(
      'Existing files were left untouched. To regenerate one from the template, delete it and run init again.',
    );
  }

  if (created.length > 0 && !result.dryRun) {
    output.out('');
    output.out('Next: productkit intake "<your idea>", then productkit clarify.');
  }
}
