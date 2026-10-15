import { type Prompt } from '../schema/prompt.js';
import { type AttestationPolicy, type StageName, type StageStatus } from '../schema/config.js';
/** Throws a guided error if `<cwd>/product/` has not been initialised. */
export declare function ensureWorkspace(productRoot: string): Promise<void>;
/**
 * Updates exactly one stage field while preserving the other YAML values and
 * serializing against the explicit v0→v1 migration.
 */
export declare function markStage(productRoot: string, stage: StageName, value: StageStatus): Promise<void>;
/** `flag` when the workspace predates the field; the gate warns in that case. */
export declare function readAttestationPolicy(productRoot: string): Promise<{
    policy: AttestationPolicy;
    declared: boolean;
}>;
/**
 * Reads one line from the controlling terminal, not from stdin. A CLI run by
 * an agent has no controlling terminal, so this is the one input path an
 * agent cannot supply on the user's behalf. It is not authentication — it is
 * separation: whoever is sitting at the terminal typed it.
 */
export declare function readStatementFromTerminal(promptText: string): Promise<string>;
/** Reads the actual original, never a synthetic source inferred from a downstream record. */
export declare function readSourcePrompt(productRoot: string, id: string): Promise<Prompt | undefined>;
