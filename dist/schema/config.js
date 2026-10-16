import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
/** Newly initialised workspaces use the additive v1 stage contract. */
export const CONFIG_SCHEMA_VERSION = 1;
export const LEGACY_CONFIG_SCHEMA_VERSION = 0;
export const stageStatusSchema = z.enum(['not_started', 'in_progress', 'done']);
export const LEGACY_STAGE_NAMES = [
    'ingest', 'discover', 'challenge', 'propose', 'decide', 'define', 'review', 'validate', 'export',
];
export const STAGE_NAMES = [
    'ingest', 'discover', 'atomic_modeling', 'graph_analysis', 'challenge', 'propose', 'decide', 'define', 'review', 'validate', 'export',
];
const stageSchema = (names) => z.object(Object.fromEntries(names.map((name) => [name, stageStatusSchema])));
export const definitionStatusSchema = z.enum(['not_started', 'draft', 'confirmed']);
/**
 * How a user statement may reach a Decision or Approval.
 * `tty`  — typed by a person on the terminal that runs the command. An agent
 *          running the CLI non-interactively has no terminal and is refused.
 * `flag` — accepted from `--user-statement`; anyone (including an agent) can
 *          pass it. The gate warns on every report while this is set.
 * Missing means `flag` for workspaces made before this field existed.
 */
export const attestationPolicySchema = z.enum(['tty', 'flag']);
const configFields = {
    product: z.object({
        name: z.string().min(1, 'product.name must not be empty'),
        created_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'product.created_at must be a YYYY-MM-DD date'),
    }),
    definition: z.object({ status: definitionStatusSchema }),
    attestation: attestationPolicySchema.optional(),
};
export const productConfigV0Schema = z.object({
    schema_version: z.literal(LEGACY_CONFIG_SCHEMA_VERSION),
    ...configFields,
    stages: stageSchema(LEGACY_STAGE_NAMES),
});
export const productConfigV1Schema = z.object({
    schema_version: z.literal(CONFIG_SCHEMA_VERSION),
    ...configFields,
    stages: stageSchema(STAGE_NAMES),
});
export const productConfigSchema = z.discriminatedUnion('schema_version', [productConfigV0Schema, productConfigV1Schema]);
function stagesFor(names) {
    return Object.fromEntries(names.map((stage) => [stage, 'not_started']));
}
export function initialConfig(name, createdAt) {
    return {
        schema_version: CONFIG_SCHEMA_VERSION,
        product: { name, created_at: createdAt },
        stages: stagesFor(STAGE_NAMES),
        definition: { status: 'not_started' },
        // The agent passes the user's words; every validation report warns. `tty` makes them typed on a terminal.
        attestation: 'flag',
    };
}
export function initialLegacyConfig(name, createdAt) {
    return {
        schema_version: LEGACY_CONFIG_SCHEMA_VERSION,
        product: { name, created_at: createdAt },
        stages: stagesFor(LEGACY_STAGE_NAMES),
        definition: { status: 'not_started' },
    };
}
export function parseProductConfig(yamlText) {
    return productConfigSchema.parse(parseYaml(yamlText));
}
//# sourceMappingURL=config.js.map