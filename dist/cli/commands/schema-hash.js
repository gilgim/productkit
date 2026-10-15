// `productkit schema` and `productkit hash`: the exact shapes and hashes the
// gate checks, printed by the code that checks them. Skills point here
// instead of carrying hand-maintained field lists that drift.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';
import { CliError, ExitCode } from '../../errors.js';
import { ensureWorkspace, readSourcePrompt } from '../../clarification/workspace.js';
import { clarificationSchema, clarificationContentHash, interpretationCheckEntrySchema, parseClarification, renderPresentation, stepsContentHash } from '../../schema/clarification.js';
import { atomicitySchema, computeStructuralSignal, evaluateAtomicityFinal, nodeGroupSchema, nodeSetContentHash } from '../../schema/node.js';
import { findingInputSchema } from '../../schema/finding.js';
import { graphEdgeSchema, relationCandidateSchema } from '../../schema/graph.js';
import { proposalInputSchema } from '../../schema/proposal.js';
import { decisionInputSchema } from '../../schema/decision.js';
import { assumptionInputSchema } from '../../schema/assumption.js';
import { semanticReviewSchema } from '../../schema/validation.js';
import { applicationPlanSchema, journeySchema, policySchema, productDefinitionSchema } from '../../schema/definition.js';
import { promptSchema } from '../../schema/prompt.js';
const SCHEMAS = {
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
export function registerSchemaHashCommands(program, output) {
    program
        .command('schema')
        .argument('[name]', 'artifact name; omit to list')
        .description('print the exact JSON Schema the gate validates an artifact against')
        .exitOverride()
        .action((name) => {
        if (!name) {
            for (const [key, { note }] of Object.entries(SCHEMAS))
                output.out(`${key.padEnd(20)} ${note}`);
            return;
        }
        const entry = SCHEMAS[name];
        if (!entry)
            throw new CliError(`Unknown schema "${name}".`, ExitCode.USAGE_OR_IO, [`Known: ${Object.keys(SCHEMAS).join(', ')}`]);
        output.out(`# ${name}: ${entry.note}`);
        output.out(JSON.stringify(z.toJSONSchema(entry.schema, { unrepresentable: 'any' }), null, 2));
    });
    const hash = program.command('hash').description('compute the hashes the gate recomputes, from the same code');
    hash
        .command('node-group')
        .option('--clarification <id>', 'Clarification to model (defaults to the latest)')
        .description('print source_content_hash and clarification_content_hash for a NodeGroup of the given Clarification')
        .exitOverride()
        .action(async (opts) => {
        const root = path.join(process.cwd(), 'product');
        await ensureWorkspace(root);
        const id = opts.clarification ?? (await (await import('../../clarification/io.js')).latestId(path.join(root, 'discovery'), 'CLR'));
        if (!id)
            throw new CliError('No Clarification found.', ExitCode.USAGE_OR_IO);
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
        .action(async (opts) => {
        const raw = parseYaml(await readFile(path.resolve(opts.input), 'utf8'));
        const { final: _ignored, ...rest } = raw;
        const parsed = atomicitySchema.omit({ final: true }).parse(rest);
        output.out(`final: ${evaluateAtomicityFinal(parsed) ?? 'null'}`);
        if (typeof raw.statement === 'string') {
            const sig = computeStructuralSignal(raw.statement);
            output.out(`structural_signal: { conjunction_count: ${sig.conjunction_count}, multiple_predicates: ${sig.multiple_predicates} }`);
        }
    });
    hash
        .command('steps')
        .option('--clarification <id>', 'Clarification (defaults to the latest)')
        .description('print presented_hash (the steps hash) and the rendered presentation for a Clarification')
        .exitOverride()
        .action(async (opts) => {
        const root = path.join(process.cwd(), 'product');
        await ensureWorkspace(root);
        const id = opts.clarification ?? (await (await import('../../clarification/io.js')).latestId(path.join(root, 'discovery'), 'CLR'));
        if (!id)
            throw new CliError('No Clarification found.', ExitCode.USAGE_OR_IO);
        const clarification = parseClarification(await readFile(path.join(root, 'discovery', `${id}.yaml`), 'utf8'));
        const prompt = await readSourcePrompt(root, clarification.prompt_ref);
        if (!prompt)
            throw new CliError(`Prompt ${clarification.prompt_ref} does not exist.`, ExitCode.USAGE_OR_IO);
        output.out(`presented_hash: ${stepsContentHash(clarification.steps)}`);
        output.out('presented_statement:');
        output.out(renderPresentation(clarification, prompt));
    });
    hash
        .command('entry')
        .requiredOption('--input <yaml>', 'an interpretation_check entry without entry_hash')
        .description('print the entry with its entry_hash filled in (prefer `productkit clarify confirm`, which does this for you)')
        .exitOverride()
        .action(async (opts) => {
        const raw = parseYaml(await readFile(path.resolve(opts.input), 'utf8'));
        const { entry_hash: _ignored, ...rest } = raw;
        const { computeEntryHash } = await import('../../schema/clarification.js');
        const stored = interpretationCheckEntrySchema.parse({ ...rest, entry_hash: '0'.repeat(64) });
        const { entry_hash: _zero, ...rest2 } = stored;
        // Whatever the input claims, an entry assembled from a file was not typed on a terminal.
        const body = { ...rest2, attestation: 'flag' };
        output.out(stringifyYaml({ ...body, entry_hash: computeEntryHash(body) }).trimEnd());
    });
    // Artifacts whose id/content_hash the gate recomputes: print the finished record from the input.
    hash
        .command('policy').requiredOption('--input <yaml>', 'a Policy without content_hash').description('print the Policy with its content_hash filled in')
        .exitOverride().action(async (opts) => { const { createPolicy } = await import('../../schema/definition.js'); const raw = parseYaml(await readFile(path.resolve(opts.input), 'utf8')); const { content_hash: _c, ...rest } = raw; output.out(stringifyYaml(createPolicy(rest)).trimEnd()); });
    hash
        .command('journey').requiredOption('--input <yaml>', 'a Journey without id/content_hash').description('print the Journey with id and content_hash filled in')
        .exitOverride().action(async (opts) => { const { createJourney } = await import('../../schema/definition.js'); const raw = parseYaml(await readFile(path.resolve(opts.input), 'utf8')); const { content_hash: _c, id: _i, ...rest } = raw; output.out(stringifyYaml(createJourney(rest)).trimEnd()); });
    hash
        .command('definition').requiredOption('--input <yaml>', 'a Product Definition without id/content_hash/history/created_at').description('print the Definition with id, content_hash, history and created_at filled in')
        .exitOverride().action(async (opts) => { const { createProductDefinition } = await import('../../schema/definition.js'); const raw = parseYaml(await readFile(path.resolve(opts.input), 'utf8')); const { content_hash: _c, id: _i, history: _h, created_at: _a, ...rest } = raw; output.out(stringifyYaml(createProductDefinition(rest)).trimEnd()); });
    hash
        .command('semantic-review').requiredOption('--input <yaml>', 'a semantic review without id/content_hash').description('print the review with id and content_hash filled in (prefer `productkit validate review --input`, which stores it)')
        .exitOverride().action(async (opts) => { const { createSemanticReview } = await import('../../schema/validation.js'); const raw = parseYaml(await readFile(path.resolve(opts.input), 'utf8')); const { content_hash: _c, id: _i, ...rest } = raw; output.out(stringifyYaml(createSemanticReview(rest)).trimEnd()); });
    hash
        .command('inputs').description('print every current artifact reference with the hash a Decision/Application/Definition snapshot must cite (kind, ref, content_hash)')
        .exitOverride().action(async () => { const root = path.join(process.cwd(), 'product'); await ensureWorkspace(root); const { currentChallengeInputs } = await import('../../clarification/challenge-store.js'); const { readDecisions, readProposals, readCurrentFindings } = await import('../../clarification/proposal-decision-store.js'); const { findingContentHash, toFindingInput } = await import('../../schema/finding.js'); const cur = await currentChallengeInputs(root); for (const i of cur.inputs)
        output.out(`${i.kind.padEnd(19)} ${i.ref.padEnd(26)} ${i.content_hash}`); for (const p of await readProposals(root))
        output.out(`${'proposal'.padEnd(19)} ${p.id.padEnd(26)} ${p.claim_hash}  (claim_hash)`); for (const d of await readDecisions(root))
        output.out(`${'decision'.padEnd(19)} ${d.id.padEnd(26)} ${d.decision_hash}`); for (const f of await readCurrentFindings(root))
        output.out(`${'finding.claim_hash'.padEnd(19)} ${f.id.padEnd(26)} ${findingContentHash(toFindingInput(f))}  (for finding_refs[].claim_hash)`); });
    hash
        .command('fingerprint').description('print the current validation input fingerprint and the evidence hashes a semantic review cites')
        .exitOverride().action(async () => { const root = path.join(process.cwd(), 'product'); await ensureWorkspace(root); const { currentValidationFingerprint } = await import('../../clarification/validation-store.js'); const fp = await currentValidationFingerprint(root); output.out(`input_fingerprint: ${fp.fingerprint}`); for (const s of fp.snapshot)
        output.out(`${s.kind.padEnd(19)} ${s.ref.padEnd(26)} ${s.content_hash}`); });
}
//# sourceMappingURL=schema-hash.js.map