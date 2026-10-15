import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { saysNo } from '../../schema/text.js';
import { isPureStructure } from '../../clarification/spans.js';
import { CliError, ExitCode, describeCause } from '../../errors.js';
import { atomicReplaceIfUnchanged, latestId } from '../../clarification/io.js';
import { SKILLS_ROOT } from '../../clarification/skills.js';
import { ensureWorkspace, markStage, readAttestationPolicy, readSourcePrompt, readStatementFromTerminal } from '../../clarification/workspace.js';
import { clarificationStepsIssue, computeEntryHash, judgeCompletion, mergeReasonIssue, parseClarification, renderPresentation, stepsContentHash, stepsReadinessIssue, uncoveredSpans, } from '../../schema/clarification.js';
/**
 * Human-readable reasons. Note what these do and don't claim:
 * `content_changed_since_confirmation` and `integrity_violation` are things
 * the CLI *detected* by recomputing a hash — not something it *proved* or
 * *prevented*. Nothing here verifies that a `user_statement` is genuinely
 * the user's own words.
 */
const REASON_MESSAGES = {
    missing_prompt: 'The referenced Prompt is missing.',
    invalid_prompt_reference: 'Prompt identity does not match the clarification/confirmation.',
    prompt_integrity_violation: 'Prompt text/hash/spans are inconsistent.',
    prompt_changed_since_clarification: 'Prompt snapshot is missing or changed; review and re-confirm without overwriting the original.',
    incomplete_steps: 'Clarification has incomplete steps or placeholder output.',
    invalid_step_reference: 'Clarification step references do not resolve.',
    presented_statement_not_rendered: 'presented_statement must be exactly the block printed below under "Show the user"; the CLI ' +
        'renders what the user sees, the agent does not.',
    reading_incomplete: 'A reading labels its sentence instead of restating it: numbers or most content words of the ' +
        'span are missing from the statements that cite it.',
    missing_merge_reason: 'A decomposition item merges several spans, or reads a many-clause span as one statement, ' +
        'without saying why.',
    uncovered_spans: 'Some Prompt spans are not accounted for. Every span must be decomposed, raised as a ' +
        'finding candidate. Only wordless structure lines (separators, bullets, list markers) are set aside, by the CLI itself.',
    no_confirmation: 'No interpretation_check entry yet — nothing has been confirmed.',
    not_agreed: 'The latest interpretation_check entry is not "agreed".',
    missing_user_statement: 'The latest interpretation_check entry has no user_statement.',
    content_changed_since_confirmation: 'The clarification steps changed after the last agreed entry — that entry no longer covers ' +
        'the current content. Re-confirmation is required.',
    integrity_violation: 'An interpretation_check entry no longer matches its stored entry_hash. This means the ' +
        'record changed after it was written; it does not identify who changed it or why.',
};
/** Lines with no words of their own that the CLI set aside itself (separators, bare numbers). */
function printStructureLines(prompt, output) {
    const structure = prompt.spans.filter((s) => isPureStructure(prompt.raw_text.slice(s.start, s.end)));
    if (!structure.length)
        return;
    output.out(`  Structure lines set aside by the CLI (${structure.length}): ${structure.map((s) => s.id).join(', ')}`);
}
/**
 * Appends one interpretation_check entry. The CLI renders the presentation,
 * computes presented_hash and entry_hash, and — with no --user-statement —
 * reads the user's words from the controlling terminal after printing the
 * rendered block there. The agent never assembles the entry by hand.
 */
export async function runClarifyConfirm(options, output) {
    const cwd = options.cwd ?? process.cwd();
    const productRoot = path.join(cwd, 'product');
    await ensureWorkspace(productRoot);
    const sourcesDir = path.join(productRoot, 'sources');
    const promptId = options.prompt ?? (await latestId(sourcesDir, 'PRM'));
    if (!promptId)
        throw new CliError('No prompt found.', ExitCode.USAGE_OR_IO);
    const sourcePrompt = await readSourcePrompt(productRoot, promptId);
    if (!sourcePrompt)
        throw new CliError(`Prompt ${promptId} does not exist.`, ExitCode.USAGE_OR_IO);
    const clarificationId = `CLR-${promptId.slice('PRM-'.length)}`;
    const clarificationPath = path.join(productRoot, 'discovery', `${clarificationId}.yaml`);
    const before = await readFile(clarificationPath, 'utf8').catch(() => { throw new CliError(`${clarificationPath} does not exist; write the Clarification steps first.`, ExitCode.USAGE_OR_IO); });
    const clarification = parseClarification(before);
    if (clarification.prompt_ref !== promptId)
        throw new CliError('Clarification does not reference the selected Prompt.', ExitCode.USAGE_OR_IO);
    // The steps must already be sound; a confirmation of broken steps is noise.
    const stepsIssue = clarificationStepsIssue(clarification.steps);
    if (stepsIssue)
        throw new CliError(`Clarification steps are not complete: ${stepsIssue.detail ?? stepsIssue.reason}`, ExitCode.GATE_BLOCKED);
    const uncovered = uncoveredSpans(clarification, sourcePrompt);
    if (uncovered.length)
        throw new CliError(`Prompt spans not accounted for: ${uncovered.join(', ')}`, ExitCode.GATE_BLOCKED, ['Decompose them, raise them as finding candidates, or list them in steps.span_coverage with a reason.']);
    const merge = mergeReasonIssue(clarification, sourcePrompt);
    if (merge)
        throw new CliError(merge, ExitCode.GATE_BLOCKED);
    const presented = renderPresentation(clarification, sourcePrompt);
    const policy = await readAttestationPolicy(productRoot);
    const attestation = options.userStatement === undefined ? 'tty' : 'flag';
    if (policy.policy === 'tty' && attestation !== 'tty')
        throw new CliError('This workspace requires the confirmation to be typed on a terminal (config attestation: tty).', ExitCode.GATE_BLOCKED, [`Run \`productkit clarify confirm --response ${options.response}\` without --user-statement, in a terminal; the CLI shows the rendered block and asks for the statement.`, 'An agent cannot do this step; hand the command to the user.']);
    const statement = options.userStatement ?? await readStatementFromTerminal(`${presented}\n\n위 내용에 대한 응답: ${options.response}\n당신의 말로 한 줄 적고 Enter (비우면 취소): `);
    if (!statement.trim())
        throw new CliError('Confirmation cancelled: empty statement.', ExitCode.USAGE_OR_IO);
    if (options.response === 'agreed' && saysNo(statement))
        throw new CliError(`Recorded as agreed, but the statement reads as a refusal: "${statement.trim().slice(0, 60)}". Use --response disagreed or partially_agreed.`, ExitCode.GATE_BLOCKED);
    const index = clarification.interpretation_check.length + 1;
    const base = {
        id: `IC-${String(index).padStart(3, '0')}`,
        presented_statement: presented,
        presented_hash: stepsContentHash(clarification.steps),
        prompt_ref: sourcePrompt.id,
        prompt_content_hash: sourcePrompt.content_hash,
        user_response: options.response,
        user_statement: statement.trim(),
        attestation,
        checked_at: (options.now ?? new Date()).toISOString(),
    };
    const entry = { ...base, entry_hash: computeEntryHash(base) };
    const next = { ...clarification, prompt_content_hash: sourcePrompt.content_hash, interpretation_check: [...clarification.interpretation_check, entry], status: options.response === 'agreed' ? 'confirmed' : 'awaiting_confirmation' };
    await atomicReplaceIfUnchanged(clarificationPath, before, stringifyYaml(next));
    output.out(`Recorded ${entry.id} (${options.response}, attestation: ${attestation}) on ${clarificationId}.`);
    const judgement = judgeCompletion(parseClarification(stringifyYaml(next)), sourcePrompt);
    output.out(judgement.confirmed ? `Clarification confirmed: ${clarificationId}` : `Clarification not yet complete: ${REASON_MESSAGES[judgement.reason]}`);
}
export async function runClarify(options, output) {
    const cwd = options.cwd ?? process.cwd();
    const productRoot = path.join(cwd, 'product');
    await ensureWorkspace(productRoot);
    const sourcesDir = path.join(productRoot, 'sources');
    const promptId = options.prompt ?? (await latestId(sourcesDir, 'PRM'));
    if (!promptId) {
        throw new CliError('No prompt found.', ExitCode.USAGE_OR_IO, [
            'Run "productkit intake <text>" first.',
        ]);
    }
    if (!/^PRM-\d{3,}$/.test(promptId))
        throw new CliError('Invalid Prompt ID.', ExitCode.USAGE_OR_IO);
    const sourcePrompt = await readSourcePrompt(productRoot, promptId);
    if (!sourcePrompt)
        throw new CliError(`Prompt ${promptId} does not exist.`, ExitCode.USAGE_OR_IO);
    const clarificationId = `CLR-${promptId.slice('PRM-'.length)}`;
    const clarificationPath = path.join(productRoot, 'discovery', `${clarificationId}.yaml`);
    const instructionPath = path.join(SKILLS_ROOT, 'clarify', 'SKILL.md');
    let text;
    try {
        text = await readFile(clarificationPath, 'utf8');
    }
    catch (cause) {
        const code = cause.code;
        if (code !== 'ENOENT') {
            throw new CliError(`Could not read ${clarificationPath}: ${describeCause(cause)}`, ExitCode.USAGE_OR_IO);
        }
    }
    if (text === undefined) {
        await markStage(productRoot, 'discover', 'in_progress');
        output.out('AI action required: Clarification has not started.');
        output.out(`  Prompt:      ${path.relative(cwd, path.join(sourcesDir, `${promptId}.yaml`))}`);
        output.out(`  Instruction: ${instructionPath}`);
        output.out(`  Write to:    ${path.relative(cwd, clarificationPath)}`);
        output.out('  Completion contract: all steps need outputs; empty relation/counterexample lists need reviewed-no-items reasons.');
        output.out(`  Span coverage: all ${sourcePrompt.spans.length} Prompt spans must be read verbatim (decomposition) or raised as finding candidates; nothing is set aside by the agent.`);
        output.out('  Shape: productkit schema clarification');
        output.out('  Spans:');
        for (const span of sourcePrompt.spans)
            output.out(`    ${span.id}  "${sourcePrompt.raw_text.slice(span.start, span.end).replace(/\s+/g, ' ').trim()}"`);
        output.out('  Bind prompt_ref + prompt_content_hash in the clarification and new confirmation; do not invent user agreement.');
        return;
    }
    let clarification;
    try {
        clarification = parseClarification(text);
    }
    catch (cause) {
        throw new CliError(`${clarificationPath} does not match the Clarification schema: ${describeCause(cause)}`, ExitCode.USAGE_OR_IO);
    }
    if (clarification.id !== clarificationId || clarification.prompt_ref !== promptId)
        throw new CliError('Clarification identity/reference does not match the selected Prompt.', ExitCode.USAGE_OR_IO);
    // Report a steps problem before "nothing confirmed yet": the agent must fix
    // the steps before anyone is asked to agree to them.
    const judgement = (() => { const j = judgeCompletion(clarification, sourcePrompt); if (j.confirmed)
        return j; if (j.reason !== 'no_confirmation')
        return j; return stepsReadinessIssue(clarification, sourcePrompt) ?? j; })();
    if (judgement.confirmed) {
        await markStage(productRoot, 'discover', 'done');
        output.out(`Clarification confirmed: ${clarificationId}`);
        output.out('(The record is internally consistent and marked agreed — this is not proof');
        output.out(' that a human actually said so; see docs/artifact-contracts.md.)');
        printStructureLines(sourcePrompt, output);
        return;
    }
    await markStage(productRoot, 'discover', 'in_progress');
    output.out(`Clarification not yet complete: ${clarificationId}`);
    output.out(`  Reason: ${REASON_MESSAGES[judgement.reason]}`);
    if (judgement.detail) {
        output.out(`  Detail: ${judgement.detail}`);
    }
    output.out(`  Instruction: ${instructionPath}`);
    // Only once the steps themselves are sound does the rendered block mean
    // anything; print it so the agent can copy it into presented_statement
    // and show it to the user verbatim.
    if (['no_confirmation', 'not_agreed', 'presented_statement_not_rendered', 'content_changed_since_confirmation', 'missing_user_statement'].includes(judgement.reason)) {
        output.out('');
        output.out('Show the user (copy into presented_statement exactly):');
        output.out('----');
        output.out(renderPresentation(clarification, sourcePrompt));
        output.out('----');
    }
}
//# sourceMappingURL=clarify.js.map