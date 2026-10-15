import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { canonicalJson, sha256Hex } from '../clarification/hash.js';
const hash = z.string().regex(/^[0-9a-f]{64}$/);
export const exportManifestSchema = z.object({ schema_version: z.literal(1), id: z.string().regex(/^EXP-[0-9a-f]{16}$/), change_id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), capability_id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), definition_ref: z.string(), definition_hash: hash, approval_ref: z.string().regex(/^APR-[0-9a-f]{16}$/), approval_hash: hash, validation_ref: z.string().regex(/^VAL-[0-9a-f]{16}$/), validation_hash: hash, input_fingerprint: hash, openspec_version: z.string().min(1), exporter_version: z.string().min(1), output_hashes: z.array(z.object({ path: z.string().min(1), sha256: hash }).strict()).min(2), created_at: z.string().datetime({ offset: true }), manifest_hash: hash }).strict().superRefine((v, c) => { const { id, manifest_hash, created_at, ...body } = v; if (v.manifest_hash !== sha256Hex(canonicalJson(body)) || v.id !== `EXP-${v.manifest_hash.slice(0, 16)}`)
    c.addIssue({ code: 'custom', message: 'Export manifest ID/hash mismatch.' }); });
export function parseExportManifest(s) { return exportManifestSchema.parse(parseYaml(s)); }
//# sourceMappingURL=export.js.map