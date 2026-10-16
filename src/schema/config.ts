import { z } from 'zod';
import { parse as parseYaml } from 'yaml';

/** Newly initialised workspaces use the additive v1 stage contract. */
export const CONFIG_SCHEMA_VERSION = 1;
export const LEGACY_CONFIG_SCHEMA_VERSION = 0;

export const stageStatusSchema = z.enum(['not_started', 'in_progress', 'done']);
export type StageStatus = z.infer<typeof stageStatusSchema>;

export const LEGACY_STAGE_NAMES = [
  'ingest', 'discover', 'challenge', 'propose', 'decide', 'define', 'review', 'validate', 'export',
] as const;

export const STAGE_NAMES = [
  'ingest', 'discover', 'atomic_modeling', 'graph_analysis', 'challenge', 'propose', 'decide', 'define', 'review', 'validate', 'export',
] as const;

export type StageName = (typeof STAGE_NAMES)[number];
export type LegacyStageName = (typeof LEGACY_STAGE_NAMES)[number];

const stageSchema = (names: readonly string[]) => z.object(
  Object.fromEntries(names.map((name) => [name, stageStatusSchema])) as Record<string, typeof stageStatusSchema>,
);

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
export type AttestationPolicy = z.infer<typeof attestationPolicySchema>;

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
export type ProductConfigV0 = z.infer<typeof productConfigV0Schema>;
export type ProductConfigV1 = z.infer<typeof productConfigV1Schema>;
export type ProductConfig = ProductConfigV0 | ProductConfigV1;

function stagesFor(names: readonly string[]) {
  return Object.fromEntries(names.map((stage) => [stage, 'not_started' as const]));
}

export function initialConfig(name: string, createdAt: string): ProductConfigV1 {
  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    product: { name, created_at: createdAt },
    stages: stagesFor(STAGE_NAMES) as Record<StageName, StageStatus>,
    definition: { status: 'not_started' },
    // The agent passes the user's words; every validation report warns. `tty` makes them typed on a terminal.
    attestation: 'flag',
  };
}

export function initialLegacyConfig(name: string, createdAt: string): ProductConfigV0 {
  return {
    schema_version: LEGACY_CONFIG_SCHEMA_VERSION,
    product: { name, created_at: createdAt },
    stages: stagesFor(LEGACY_STAGE_NAMES) as Record<LegacyStageName, StageStatus>,
    definition: { status: 'not_started' },
  };
}

export function parseProductConfig(yamlText: string): ProductConfig {
  return productConfigSchema.parse(parseYaml(yamlText));
}
