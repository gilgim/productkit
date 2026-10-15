import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';

import { CliError, ExitCode, describeCause } from '../../errors.js';
import { atomicWriteFile, nextSequentialId } from '../../clarification/io.js';
import { SEGMENTATION_VERSION, segmentSpans } from '../../clarification/spans.js';
import { ensureWorkspace, markStage } from '../../clarification/workspace.js';
import { computePromptHash, promptSchema, type Prompt } from '../../schema/prompt.js';
import type { Output } from '../output.js';

export interface IntakeOptions {
  text?: string | undefined;
  file?: string | undefined;
  cwd?: string | undefined;
  now?: Date | undefined;
}

export async function runIntake(options: IntakeOptions, output: Output): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const productRoot = path.join(cwd, 'product');

  if (options.text !== undefined && options.file !== undefined) {
    throw new CliError('Pass either <text> or --file, not both.', ExitCode.USAGE_OR_IO);
  }

  let rawText: string;
  if (options.file !== undefined) {
    const filePath = path.resolve(cwd, options.file);
    try {
      rawText = await readFile(filePath, 'utf8');
    } catch (cause) {
      throw new CliError(
        `Could not read ${options.file}: ${describeCause(cause)}`,
        ExitCode.USAGE_OR_IO,
      );
    }
  } else if (options.text !== undefined) {
    rawText = options.text;
  } else {
    throw new CliError(
      'Provide a prompt: productkit intake "<text>" or productkit intake --file <path>.',
      ExitCode.USAGE_OR_IO,
    );
  }

  if (rawText.trim().length === 0) {
    throw new CliError('Prompt text must not be empty.', ExitCode.USAGE_OR_IO);
  }

  await ensureWorkspace(productRoot);

  const sourcesDir = path.join(productRoot, 'sources');
  const id = await nextSequentialId(sourcesDir, 'PRM');

  const prompt: Prompt = {
    id,
    raw_text: rawText,
    received_at: (options.now ?? new Date()).toISOString(),
    content_hash: computePromptHash(rawText),
    spans: segmentSpans(rawText, SEGMENTATION_VERSION),
    segmentation: SEGMENTATION_VERSION,
  };
  promptSchema.parse(prompt);

  const promptPath = path.join(sourcesDir, `${id}.yaml`);
  await atomicWriteFile(promptPath, stringifyYaml(prompt), { overwrite: false });
  await markStage(productRoot, 'ingest', 'done');

  output.out(`Prompt saved: ${id}`);
  output.out(`  ${path.relative(cwd, promptPath)}`);
  output.out('');
  output.out('Next: productkit clarify');
}
