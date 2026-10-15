import { z } from 'zod';
export declare const exportManifestSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<1>;
    id: z.ZodString;
    change_id: z.ZodString;
    capability_id: z.ZodString;
    definition_ref: z.ZodString;
    definition_hash: z.ZodString;
    approval_ref: z.ZodString;
    approval_hash: z.ZodString;
    validation_ref: z.ZodString;
    validation_hash: z.ZodString;
    input_fingerprint: z.ZodString;
    openspec_version: z.ZodString;
    exporter_version: z.ZodString;
    output_hashes: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        sha256: z.ZodString;
    }, z.core.$strict>>;
    created_at: z.ZodString;
    manifest_hash: z.ZodString;
}, z.core.$strict>;
export type ExportManifest = z.infer<typeof exportManifestSchema>;
export declare function parseExportManifest(s: string): {
    schema_version: 1;
    id: string;
    change_id: string;
    capability_id: string;
    definition_ref: string;
    definition_hash: string;
    approval_ref: string;
    approval_hash: string;
    validation_ref: string;
    validation_hash: string;
    input_fingerprint: string;
    openspec_version: string;
    exporter_version: string;
    output_hashes: {
        path: string;
        sha256: string;
    }[];
    created_at: string;
    manifest_hash: string;
};
