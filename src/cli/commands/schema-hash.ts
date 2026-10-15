// `productkit schema` and `productkit hash`: the exact shapes and hashes the
// gate checks, printed by the code that checks them. Skills point here
// instead of carrying hand-maintained field lists that drift.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { Command } from 'commander';
import { z } from 'zod';

import { CliError, ExitCode } from '../../errors.js';
import { ensureWorkspace, readSourcePrompt } from '../../clarification/workspace.js';
import { clarificationSchema, clarificationContentHash, interpretationCheckEntrySchema, parseClarification, renderPresentation, stepsContentHash } from '../../schema/clarification.js';
import { atomicitySchema, evaluateAtomicityFinal, nodeGroupSchema, nodeSetContentHash } from '../../schema/node.js';
import { findingInputSchema } from '../../schema/finding.js';
import { graphEdgeSchema, relationCandidateSchema } from '../../schema/graph.js';
import { proposalInputSchema } from '../../schema/proposal.js';
import { decisionInputSchema } from '../../schema/decision.js';
import { assumptionInputSchema } from '../../schema/assumption.js';
import { semanticReviewSchema } from '../../schema/validation.js';
import { applicationPlanSchema, journeySchema, policySchema, productDefinitionSchema } from '../../schema/definition.js';
import { promptSchema } from '../../schema/prompt.js';
import type { Output } from '../output.js';

const SCHEMAS: Record<string, { schema: z.ZodTypeAny; note: string }> = {
  prompt: { schema: promptSchema, note: 'product/sources/PRM-xxx.yaml — written by `productkit intake`; never edit.' },
  clarification: { schema: clarificationSchema, note: 'product/discovery/CLR-xxx.yaml — the agent writes steps and finding_candidates; `productkit clarify confirm` appends interpretation_check.' },
  'clarification-entry': { schema: interpretationCheckEntrySchema, note: 'one interpretation_check entry — produced by `productkit clarify confirm`.' },
  'node-group': { schema: nodeGroupSchema, note: 'product/nodes/NDG-xxx.yaml — get the two hashes from `productkit hash node-group`.' },
  atomicity: { schema: atomicitySchema, note: 'atomicity block of one Node — get `final` from `productkit hash atomicity`.' },
  finding: { schema: findingInputSchema, note: 'input for `productkit challenge finding add --input`.' },
  edge: { schema: graphEdgeSchema, note: 'input for `productkit graph edge add --input`.' },
  candidate: { schema: relationCandidateSchema, note: 'stored RelationCandidate; `productkit graph candidate add` takes original_relation_name, source_node_ref, target_node_ref, proposed_meaning, evidence_refs.' },
  proposal: { schema: proposalInputSchema, note: 'input for `productkit propose add --input`.' },
  decision: { schema: decisionInputSchema, note: 'input for `productkit decide record --input` (user_statement, rationale, scope and attestation come from the command, not the file).' },
  assumption: { schema: assumptionInputSchema, note: 'input for `productkit assumption add --input`.' },
  'semantic-review': { schema: semanticReviewSchema, note: 'input for `productkit validate review --input` (id and content_hash are computed).' },
  definition: { schema: productDefinitionSchema, note: 'product/definition.yaml — written through an Application, not by hand.' },
  policy: { schema: policySchema, note: 'product/policies/POL-xxx.yaml.' },
  journey: { schema: journeySchema, note: 'product/journeys/JRN-xxx.yaml.' },
  'application-plan': { schema: applicationPlanSchema, note: 'input for `productkit define application plan --input`.' },
};

export function registerSchemaHashCommands(program: Command, output: Output): void {
  program
    .command('schema')
    .argument('[name]', 'artifact name; omit to list')
    .description('print the exact JSON Schema the gate validates an artifact against')
    .exitOverride()
    .action((name?: string) => {
      if (!name) {
        for (const [key, { note }] of Object.entries(SCHEMAS)) output.out(`${key.padEnd(20)} ${note}`);
        return;
      }
      const entry = SCHEMAS[name];
      if (!entry) throw new CliError(`Unknown schema "${name}".`, ExitCode.USAGE_OR_IO, [`Known: ${Object.keys(SCHEMAS).join(', ')}`]);
      output.out(`# ${name}: ${entry.note}`);
      output.out(JSON.stringify(z.toJSONSchema(entry.schema, { unrepresentable: 'any' }), null, 2));
    });

  const hash = program.command('hash').description('compute the hashes the gate recomputes, from the same code');
  hash
    .command('node-group')
    .option('--clarification <id>', 'Clarification to model (defaults to the latest)')
    .description('print source_content_hash and clarification_content_hash for a NodeGroup of the given Clarification')
    .exitOverride()
    .action(async (opts: { clarification?: string }) => {
      const root = path.join(process.cwd(), 'product'); await ensureWorkspace(root);
      const id = opts.clarification ?? (await (await import('../../clarification/io.js')).latestId(path.join(root, 'discovery'), 'CLR'));
      if (!id) throw new CliError('No Clarification found.', ExitCode.USAGE_OR_IO);
      const clarification = parseClarification(await readFile(path.join(root, 'discovery', `${id}.yaml`), 'utf8'));
      output.out(`clarification_ref: ${clarification.id}`);
      output.out(`source_content_hash: ${nodeSetContentHash(clarification.steps)}`);
      output.out(`clarification_content_hash: ${clarificationContentHash(clarification)}`);
      output.out(`decomposition_count: ${clarification.steps.decomposition.length}`);
    });
  hash
    .command('atomicity')
    .requiredOption('--input <yaml>', 'file holding single_verifiable_subject, decomposability, meaning_preservation')
    .description('print the atomicity.final the CLI will recompute from the three sub-verdicts')
    .exitOverride()
    .action(async (opts: { input: string }) => {
      const raw = parseYaml(await readFile(path.resolve(opts.input), 'utf8')) as Record<string, unknown>;
      const { final: _ignored, ...rest } = raw;
      const parsed = atomicitySchema.omit({ final: true }).parse(rest);
      output.out(`final: ${evaluateAtomicityFinal(parsed) ?? 'null'}`);
    });
  hash
    .command('steps')
    .option('--clarification <id>', 'Clarification (defaults to the latest)')
    .description('print presented_hash (the steps hash) and the rendered presentation for a Clarification')
    .exitOverride()
    .action(async (opts: { clarification?: string }) => {
      const root = path.join(process.cwd(), 'product'); await ensureWorkspace(root);
      const id = opts.clarification ?? (await (await import('../../clarification/io.js')).latestId(path.join(root, 'discovery'), 'CLR'));
      if (!id) throw new CliError('No Clarification found.', ExitCode.USAGE_OR_IO);
      const clarification = parseClarification(await readFile(path.join(root, 'discovery', `${id}.yaml`), 'utf8'));
      const prompt = await readSourcePrompt(root, clarification.prompt_ref);
      if (!prompt) throw new CliError(`Prompt ${clarification.prompt_ref} does not exist.`, ExitCode.USAGE_OR_IO);
      output.out(`presented_hash: ${stepsContentHash(clarification.steps)}`);
      output.out('presented_statement:');
      output.out(renderPresentation(clarification, prompt));
    });
  hash
    .command('entry')
    .requiredOption('--input <yaml>', 'an interpretation_check entry without entry_hash')
    .description('print the entry with its entry_hash filled in (prefer `productkit clarify confirm`, which does this for you)')
    .exitOverride()
    .action(async (opts: { input: string }) => {
      const raw = parseYaml(await readFile(path.resolve(opts.input), 'utf8')) as Record<string, unknown>;
      const { entry_hash: _ignored, ...rest } = raw;
      const { computeEntryHash } = await import('../../schema/clarification.js');
      const stored = interpretationCheckEntrySchema.parse({ ...rest, entry_hash: '0'.repeat(64) });
      const { entry_hash: _zero, ...body } = stored;
      output.out(stringifyYaml({ ...body, entry_hash: computeEntryHash(body) }).trimEnd());
    });
}
