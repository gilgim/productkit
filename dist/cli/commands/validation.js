import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { CliError, ExitCode } from '../../errors.js';
import { ensureWorkspace, readStatementFromTerminal } from '../../clarification/workspace.js';
import { approvalStatus, createValidationReport, readValidationReports, recordApproval, recordSemanticReview } from '../../clarification/validation-store.js';
const root = () => path.join(process.cwd(), 'product');
export function registerValidationCommands(program, output) {
    const validate = program.command('validate').description('recompute current structural readiness; never implies semantic correctness or approval');
    validate.option('--review <id>').action(async (opts) => { await ensureWorkspace(root()); let report; try {
        report = await createValidationReport(root(), opts.review);
    }
    catch (error) {
        if (error instanceof CliError && /Product Definition is required/.test(error.message)) {
            output.out('PRODUCT READINESS BLOCKED');
            output.out('FAIL definition.required: Product Definition is missing.');
            throw new CliError('Product readiness is blocked.', ExitCode.GATE_BLOCKED);
        }
        throw error;
    } output.out(`PRODUCT READINESS ${report.readiness.toUpperCase()} — ${report.id}`); output.out(`Structure: ${report.structural_status.toUpperCase()}; semantic review: ${report.semantic_status.toUpperCase()}; Definition: ${report.definition_ref} ${report.definition_hash}`); for (const c of report.checks)
        if (c.status !== 'pass')
            output.out(`${c.status.toUpperCase()} ${c.id}: ${c.message}`); output.out('Machine checks establish structure and current hashes only; semantic correctness and user intent are not proven.'); if (report.readiness !== 'ready')
        throw new CliError(`Product readiness is ${report.readiness}.`, ExitCode.GATE_BLOCKED); });
    validate.command('review').requiredOption('--input <yaml>').description('record snapshot-bound semantic review coverage supplied by the Agent').action(async (opts) => { await ensureWorkspace(root()); const value = parseYaml(await readFile(path.resolve(opts.input), 'utf8')); const review = await recordSemanticReview(root(), value); output.out(`Semantic review ${review.id} recorded for ${review.definition_ref}; this is an assessment record, not approval.`); });
    const approve = program.command('approve').description('record and inspect explicit user approval');
    approve.command('record').requiredOption('--validation <id>').option('--user-statement <text>', 'the approval statement; omit it to type it on the terminal (required when config attestation is tty)').requiredOption('--scope <text>').action(async (opts) => {
        await ensureWorkspace(root());
        // No flag → the statement is read from the controlling terminal, which an
        // agent does not have. That is the only input path the CLI can attribute
        // to a person at the keyboard rather than to whoever ran the command.
        const attestation = opts.userStatement === undefined ? 'tty' : 'flag';
        const statement = opts.userStatement ?? await readStatementFromTerminal(`Approve ValidationReport ${opts.validation} for scope "${opts.scope}".\nType your approval statement and press Enter (empty cancels): `);
        if (!statement.trim())
            throw new CliError('Approval cancelled: empty statement.', ExitCode.USAGE_OR_IO);
        const result = await recordApproval(root(), opts.validation, statement, opts.scope, attestation);
        output.out(`Approval ${result.id}: recorded for ${result.definition_ref} at ${result.definition_hash} (attestation: ${attestation}).`);
        output.out(attestation === 'tty' ? 'The statement was typed on this terminal. The CLI cannot prove who sat here; it can say the agent did not.' : 'CLI verifies structure and hashes only; speaker identity and statement authenticity are not proven.');
    });
    approve.command('status').action(async () => { await ensureWorkspace(root()); const result = await approvalStatus(root()); if (result.status === 'missing') {
        output.out('Approval: MISSING');
        return;
    } output.out(`Approval ${result.approval.id}: ${result.status.toUpperCase()} for ${result.approval.definition_ref} ${result.approval.definition_hash}.`); if (result.status !== 'valid')
        throw new CliError('Current approval is stale.', ExitCode.GATE_BLOCKED); });
}
//# sourceMappingURL=validation.js.map