import type { Command } from 'commander';
import type { Output } from '../output.js';
/**
 * Exposes the deterministic helpers that Skills previously reached through
 * `import('productkit')`. A globally installed package is not resolvable by
 * ESM import from a consuming app, but the CLI is always on PATH — so the
 * Agent calls the same library functions through here and gets exactly the
 * value the CLI gates recompute.
 */
export type ComputeHelper = 'steps-hash' | 'entry-hash' | 'atomicity-final' | 'clarification-content-hash' | 'structural-signal';
export interface ComputeOptions {
    cwd?: string | undefined;
    /** Injected stdin text for tests; real runs read process.stdin for `-`. */
    stdin?: string | undefined;
}
export declare function runCompute(helper: ComputeHelper, source: string, options: ComputeOptions, output: Output): Promise<void>;
/**
 * Prints the current input hashes the Proposal/Decision/Assumption gates
 * compare against, as YAML flow entries that paste straight into
 * input_snapshot / evidence_refs. Proposals are listed with their claim hash.
 */
export declare function runInputHashes(options: {
    cwd?: string | undefined;
    kind?: string | undefined;
}, output: Output): Promise<void>;
/** claim_hash for finding_refs, and finding_hash for an Assumption. */
export declare function runFindingClaimHash(id: string, options: {
    cwd?: string | undefined;
}, output: Output): Promise<void>;
/**
 * Completes a Policy or Journey draft with its id/content_hash and prints the
 * exact YAML to use as an Application target's after_content. Policies and
 * Journeys are written only through Applications, and their hashes are
 * otherwise library-only.
 */
export declare function runArtifact(kind: 'policy' | 'journey', source: string, options: ComputeOptions, output: Output): Promise<void>;
/** sha256 of the exact text, for Application before_hash/after_hash. */
export declare function runTextHash(source: string, options: ComputeOptions, output: Output): Promise<void>;
export declare function registerComputeCommand(program: Command, output: Output): void;
