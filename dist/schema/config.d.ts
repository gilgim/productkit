import { z } from 'zod';
/** Newly initialised workspaces use the additive v1 stage contract. */
export declare const CONFIG_SCHEMA_VERSION = 1;
export declare const LEGACY_CONFIG_SCHEMA_VERSION = 0;
export declare const stageStatusSchema: z.ZodEnum<{
    done: "done";
    in_progress: "in_progress";
    not_started: "not_started";
}>;
export type StageStatus = z.infer<typeof stageStatusSchema>;
export declare const LEGACY_STAGE_NAMES: readonly ['ingest', 'discover', 'challenge', 'propose', 'decide', 'define', 'review', 'validate', 'export'];
export declare const STAGE_NAMES: readonly ['ingest', 'discover', 'atomic_modeling', 'graph_analysis', 'challenge', 'propose', 'decide', 'define', 'review', 'validate', 'export'];
export type StageName = (typeof STAGE_NAMES)[number];
export type LegacyStageName = (typeof LEGACY_STAGE_NAMES)[number];
export declare const definitionStatusSchema: z.ZodEnum<{
    confirmed: "confirmed";
    draft: "draft";
    not_started: "not_started";
}>;
/**
 * How a user statement may reach a Decision or Approval.
 * `tty`  — typed by a person on the terminal that runs the command. An agent
 *          running the CLI non-interactively has no terminal and is refused.
 * `flag` — accepted from `--user-statement`; anyone (including an agent) can
 *          pass it. The gate warns on every report while this is set.
 * Missing means `flag` for workspaces made before this field existed.
 */
export declare const attestationPolicySchema: z.ZodEnum<{
    flag: "flag";
    tty: "tty";
}>;
export type AttestationPolicy = z.infer<typeof attestationPolicySchema>;
export declare const productConfigV0Schema: z.ZodObject<{
    product: z.ZodObject<{
        name: z.ZodString;
        created_at: z.ZodString;
    }, z.core.$strip>;
    definition: z.ZodObject<{
        status: z.ZodEnum<{
            confirmed: "confirmed";
            draft: "draft";
            not_started: "not_started";
        }>;
    }, z.core.$strip>;
    attestation: z.ZodOptional<z.ZodEnum<{
        flag: "flag";
        tty: "tty";
    }>>;
    schema_version: z.ZodLiteral<0>;
    stages: z.ZodObject<{
        [x: string]: z.ZodEnum<{
            done: "done";
            in_progress: "in_progress";
            not_started: "not_started";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const productConfigV1Schema: z.ZodObject<{
    product: z.ZodObject<{
        name: z.ZodString;
        created_at: z.ZodString;
    }, z.core.$strip>;
    definition: z.ZodObject<{
        status: z.ZodEnum<{
            confirmed: "confirmed";
            draft: "draft";
            not_started: "not_started";
        }>;
    }, z.core.$strip>;
    attestation: z.ZodOptional<z.ZodEnum<{
        flag: "flag";
        tty: "tty";
    }>>;
    schema_version: z.ZodLiteral<1>;
    stages: z.ZodObject<{
        [x: string]: z.ZodEnum<{
            done: "done";
            in_progress: "in_progress";
            not_started: "not_started";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const productConfigSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    product: z.ZodObject<{
        name: z.ZodString;
        created_at: z.ZodString;
    }, z.core.$strip>;
    definition: z.ZodObject<{
        status: z.ZodEnum<{
            confirmed: "confirmed";
            draft: "draft";
            not_started: "not_started";
        }>;
    }, z.core.$strip>;
    attestation: z.ZodOptional<z.ZodEnum<{
        flag: "flag";
        tty: "tty";
    }>>;
    schema_version: z.ZodLiteral<0>;
    stages: z.ZodObject<{
        [x: string]: z.ZodEnum<{
            done: "done";
            in_progress: "in_progress";
            not_started: "not_started";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    product: z.ZodObject<{
        name: z.ZodString;
        created_at: z.ZodString;
    }, z.core.$strip>;
    definition: z.ZodObject<{
        status: z.ZodEnum<{
            confirmed: "confirmed";
            draft: "draft";
            not_started: "not_started";
        }>;
    }, z.core.$strip>;
    attestation: z.ZodOptional<z.ZodEnum<{
        flag: "flag";
        tty: "tty";
    }>>;
    schema_version: z.ZodLiteral<1>;
    stages: z.ZodObject<{
        [x: string]: z.ZodEnum<{
            done: "done";
            in_progress: "in_progress";
            not_started: "not_started";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>], "schema_version">;
export type ProductConfigV0 = z.infer<typeof productConfigV0Schema>;
export type ProductConfigV1 = z.infer<typeof productConfigV1Schema>;
export type ProductConfig = ProductConfigV0 | ProductConfigV1;
export declare function initialConfig(name: string, createdAt: string): ProductConfigV1;
export declare function initialLegacyConfig(name: string, createdAt: string): ProductConfigV0;
export declare function parseProductConfig(yamlText: string): ProductConfig;
