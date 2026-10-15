import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify } from 'yaml';
import { SKILLS_ROOT } from './skills.js';
import { validateFindingReferences } from './finding-store.js';
import { atomicCreateFile } from './io.js';
import { canonicalJson, sha256Hex } from './hash.js';
import { currentChallengeInputs, readChallengeRuns, refreshChallengeRun, validateChallengeRunReferences } from './challenge-store.js';
import { readCurrentFindings, readDecisions, readProposals, readAssumptions, decisionStaleness } from './proposal-decision-store.js';
import { readApplications, applicationFreshness, readDefinition, readPolicies, readJourneys, validateDefinitionReferences, validatePolicyReferences } from './definition-store.js';
import { readGraphDocument, readRelationCandidates } from './graph-store.js';
import { parseImpactReport } from '../schema/impact.js';
import { createSemanticReview, semanticReviewIssue, semanticReviewSchema, validationReportSchema, approvalSchema, semanticAreas } from '../schema/validation.js';
import { loadGraphWorkspace } from './provenance.js';
import { readAttestationPolicy } from './workspace.js';
import { parseClarification } from '../schema/clarification.js';
import { SEGMENTATION_VERSION } from './spans.js';
import { forbiddenTextIssue, saysNo } from '../schema/text.js';
import { parseProductConfig } from '../schema/config.js';
import { findingContentHash, toFindingInput } from '../schema/finding.js';
import { CliError, ExitCode } from '../errors.js';
const dirs = { validations: 'validations', semantic: 'semantic-reviews', approvals: 'approvals' };
const files = async (dir) => { try {
    return (await readdir(dir)).filter(x => x.endsWith('.yaml')).sort();
}
catch (e) {
    if (e.code === 'ENOENT')
        return [];
    throw e;
} };
const readYaml = async (file) => parseYaml(await readFile(file, 'utf8'));
async function inventory(root) {
    const current = await currentChallengeInputs(root);
    const out = current.inputs.map(x => ({ kind: x.kind, ref: x.ref, content_hash: x.content_hash }));
    const add = (kind, ref, value) => out.push({ kind, ref, content_hash: sha256Hex(canonicalJson(value)) });
    for (const x of await readProposals(root))
        add('proposal', x.id, x);
    for (const x of await readDecisions(root))
        add('decision', x.id, x);
    for (const x of await readAssumptions(root))
        add('assumption', x.id, x);
    for (const x of await readCurrentFindings(root))
        add('finding', x.id, x);
    for (const x of await readApplications(root))
        add('application', x.id, x);
    for (const x of await readPolicies(root))
        add('policy', x.id, x);
    for (const x of await readJourneys(root))
        add('journey', x.id, x);
    const definition = await readDefinition(root);
    if (definition)
        add('definition', definition.id, definition);
    for (const x of await readChallengeRuns(root))
        add('challenge_run', x.id, x);
    try {
        const skill = await readFile(path.join(SKILLS_ROOT, 'validate', 'SKILL.md'), 'utf8');
        out.push({ kind: 'skill', ref: 'validate/SKILL.md', content_hash: sha256Hex(skill) });
    }
    catch { }
    // The attestation policy is an input: flipping it must stale every review and report.
    try {
        const policy = await readAttestationPolicy(root);
        out.push({ kind: 'config', ref: 'attestation', content_hash: sha256Hex(canonicalJson(policy)) });
    }
    catch { }
    const appDir = path.join(root, 'graph');
    for (const f of [...await files(appDir), ...await files(path.join(appDir, 'reports'))]) {
        if (f === 'edges.yaml')
            continue;
        const fp = f.includes(path.sep) ? path.join(appDir, f) : path.join(appDir, f);
        try {
            const report = parseImpactReport(await readFile(fp, 'utf8'));
            add('impact_report', report.analysis_id, report);
        }
        catch { }
    }
    return out.sort((a, b) => `${a.kind}:${a.ref}`.localeCompare(`${b.kind}:${b.ref}`));
}
export async function currentValidationFingerprint(root, rulesVersion = 'validation-rules-v2') { const snapshot = await inventory(root); return { snapshot, fingerprint: sha256Hex(canonicalJson({ rules_version: rulesVersion, snapshot })) }; }
export async function recordSemanticReview(root, input) { const definition = await readDefinition(root); if (!definition || definition.id !== input.definition_ref || definition.content_hash !== input.definition_hash)
    throw new CliError('Semantic review must bind the current Product Definition.', ExitCode.GATE_BLOCKED); const current = await currentValidationFingerprint(root); if (input.input_fingerprint !== current.fingerprint)
    throw new CliError('Semantic review input fingerprint is stale.', ExitCode.GATE_BLOCKED); const index = new Map(current.snapshot.map(r => [`${r.kind}:${r.ref}`, r.content_hash])); for (const [areaName, area] of Object.entries(input.areas)) {
    if (!area || !area.rationale.trim())
        throw new CliError(`Semantic review area ${areaName} requires a status and rationale.`, ExitCode.GATE_BLOCKED);
    for (const ref of area.evidence_refs)
        if (index.get(`${ref.kind}:${ref.ref}`) !== ref.content_hash)
            throw new CliError(`Semantic review evidence is missing or stale: ${ref.kind}:${ref.ref}`, ExitCode.GATE_BLOCKED);
} for (const id of input.finding_refs)
    if (!index.has(`finding:${id}`))
        throw new CliError(`Semantic review Finding does not resolve: ${id}`, ExitCode.GATE_BLOCKED); const hollow = semanticReviewIssue(input, new Set(current.snapshot.map(r => r.kind))) ?? fidelityIssue(input, definition, [...(await readPolicies(root)).filter(p => definition.policy_refs.includes(p.id)), ...(await readJourneys(root)).filter(j => definition.journey_refs.includes(j.id))]) ?? await carryOverIssue(root, input); if (hollow)
    throw new CliError(`Semantic review is hollow: ${hollow}`, ExitCode.GATE_BLOCKED); for (const area of semanticAreas.options)
    if (!input.areas[area])
        throw new CliError(`Semantic review area ${area} must be reviewed or explicitly marked not applicable.`, ExitCode.GATE_BLOCKED); const review = createSemanticReview(input); const dir = path.join(root, dirs.semantic); await mkdir(dir, { recursive: true }); const file = path.join(dir, `${review.id}.yaml`); if (await atomicCreateFile(file, stringify(review)))
    return review; const prior = semanticReviewSchema.parse(await readYaml(file)); if (prior.content_hash !== review.content_hash)
    throw new CliError('Semantic review ID collision.', ExitCode.GATE_BLOCKED); return prior; }
/**
 * Every (item, source Node) pair needs its own verdict. A blanket "all
 * preserved" cannot be written; N pairs need N lines with N reasons, each
 * auditable against the two texts the export prints side by side.
 */
function fidelityIssue(review, definition, extra = []) { const have = new Set(review.item_fidelity.map(f => `${f.item_ref}:${f.node_ref}`)); const missing = []; for (const item of [...definition.items, ...extra])
    for (const ref of item.provenance.source_refs)
        if (ref.kind === 'node' && !have.has(`${item.id}:${ref.ref}`))
            missing.push(`${item.id}×${ref.ref}`); if (missing.length)
    return `item_fidelity has no verdict for ${missing.length} item/Node pair(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', ...' : ''}`; return undefined; }
/**
 * A later review of the same inputs may not quietly drop what an earlier
 * one said was unreviewed. Each earlier unreviewed item must still be listed,
 * or be named in unreviewed_scope_resolved with evidence.
 */
async function carryOverIssue(root, review) { const dir = path.join(root, dirs.semantic); const prior = []; for (const f of await files(dir)) {
    try {
        const r = semanticReviewSchema.parse(await readYaml(path.join(dir, f)));
        prior.push(r);
    }
    catch { }
} const still = new Set(review.unreviewed_scope.map(s => s.trim())); const resolved = new Set(review.unreviewed_scope_resolved.map(s => s.item.trim())); for (const p of prior)
    for (const item of p.unreviewed_scope) {
        const key = item.trim();
        if (!still.has(key) && !resolved.has(key))
            return `earlier review ${p.id} listed "${key}" as unreviewed; it must stay in unreviewed_scope or appear in unreviewed_scope_resolved with evidence.`;
    } return undefined; }
async function checksFor(root, review) {
    const definition = await readDefinition(root);
    if (!definition)
        throw new CliError('Product Definition is required for validation.', ExitCode.GATE_BLOCKED);
    const current = await currentValidationFingerprint(root);
    const checks = [];
    const add = (id, category, status, message, refs = []) => checks.push({ id, category, status, message, refs });
    const config = parseProductConfig(await readFile(path.join(root, 'config.yaml'), 'utf8'));
    // Who typed the statements. Not a check on content: a named, visible
    // weakening of the gate that follows every report into the export.
    const policy = await readAttestationPolicy(root);
    if (policy.policy === 'tty')
        add('attestation.policy', 'structure', 'pass', 'Decisions and approvals must be typed on a terminal by a person (config attestation: tty).');
    else if (policy.declared)
        add('attestation.policy', 'structure', 'warn', 'config attestation: flag — user statements are accepted from --user-statement; the CLI cannot tell who passed them.');
    else
        add('attestation.policy', 'structure', 'fail', 'config.yaml declares no attestation policy. Add `attestation: tty` (statements typed on a terminal) or `attestation: flag` (accepted from --user-statement, warned on every report).');
    for (const d of await readDecisions(root))
        if (d.attestation !== 'tty' && policy.policy === 'tty')
            add(`decision.attestation.${d.id}`, 'decision', 'fail', `Decision ${d.id} was recorded from --user-statement, but this workspace requires terminal-typed statements.`);
    if (policy.policy === 'tty') {
        for (const f of await readCurrentFindings(root)) {
            const last = f.confirmation_history.at(-1);
            if (last && last.attestation !== 'tty')
                add(`finding.attestation.${f.id}`, 'finding', 'fail', `Finding ${f.id} confirmation was passed as a flag, but this workspace requires terminal-typed statements.`);
        }
        for (const file of await files(path.join(root, 'discovery'))) {
            try {
                const clr = parseClarification(await readFile(path.join(root, 'discovery', file), 'utf8'));
                const last = clr.interpretation_check.at(-1);
                if (last && last.attestation !== 'tty')
                    add(`clarification.attestation.${clr.id}`, 'traceability', 'fail', `Clarification ${clr.id} confirmation was not typed on a terminal (attestation ${last.attestation ?? 'missing'}), but this workspace requires it.`);
            }
            catch { }
        }
    }
    add('definition.non_empty', 'structure', definition.items.length ? 'pass' : 'fail', definition.items.length ? 'Definition has content.' : 'Definition has no product items.');
    const normative = definition.items.some(i => ['functional_requirement', 'nonfunctional_requirement', 'acceptance_criterion'].includes(i.kind));
    add('definition.normative', 'structure', normative ? 'pass' : 'fail', normative ? 'Definition states at least one requirement or acceptance criterion.' : 'Definition has no functional/nonfunctional requirement or acceptance criterion item; goals, scope and attached Policies alone are not a product definition.');
    // Constitution 11, both halves. (1) Every Prompt that was taken in must have
    // reached a modeled NodeGroup — otherwise its content never entered the
    // pipeline. (2) Every current Node must land in the Definition, in an
    // explicit exclusion Decision, or in an unresolved Finding.
    const workspace = await loadGraphWorkspace(root);
    const sourceIssues = workspace.issues.filter(i => ['missing_clarification', 'duplicate_clarification', 'unconfirmed_clarification', 'missing_node_group', 'unmodeled_node_group', 'invalid_prompt', 'missing_prompt', 'invalid_clarification_or_group', 'duplicate_node_id'].includes(i.code));
    if (sourceIssues.length)
        add('source.coverage', 'traceability', 'fail', `Source content has not reached modeled Nodes: ${sourceIssues.map(i => `${i.ref} (${i.code})`).join('; ')}`);
    else
        add('source.coverage', 'traceability', 'pass', `All ${workspace.prompts.size} Prompt(s) are clarified and modeled.`);
    // A finding candidate parked at clarify time must become a Finding the
    // user confirmed; otherwise the spans it covers left the pipeline unseen.
    {
        const findingsAll = await readCurrentFindings(root);
        const promoted = new Map();
        for (const f of findingsAll) {
            if (f.review_status !== 'confirmed')
                continue;
            for (const c of f.candidate_refs ?? [])
                promoted.set(`${c.clarification_ref}#${c.index}`, { spans: [...c.span_refs].sort(), status: f.resolution_status });
        }
        // A candidate's sentence ends in exactly one of two places: an open,
        // user-confirmed Finding (visible in the export), or a requirement item
        // that carries the sentence verbatim. A Finding closed by any other route
        // would make the sentence disappear.
        const sq = (t) => t.replace(/\s+/g, ' ').trim().replace(/[.。]$/, '');
        const itemTexts = definition.items.filter(i => ['functional_requirement', 'nonfunctional_requirement', 'acceptance_criterion'].includes(i.kind)).map(i => sq(i.text));
        const unpromoted = [];
        for (const f of await files(path.join(root, 'discovery'))) {
            try {
                const clr = parseClarification(await readFile(path.join(root, 'discovery', f), 'utf8'));
                const prompt = workspace.prompts.get(clr.prompt_ref);
                clr.finding_candidates.forEach((c, i) => { const key = `${clr.id}#${i}`; const got = promoted.get(key); const want = [...c.span_refs].sort(); if (!got) {
                    unpromoted.push(`${key} (${c.span_refs.join(', ')}) — no user-confirmed Finding carries it`);
                    return;
                } if (got.spans.length !== want.length || got.spans.some((x, k) => x !== want[k])) {
                    unpromoted.push(`${key} — carrying Finding names spans ${got.spans.join(', ')}, candidate has ${want.join(', ')}`);
                    return;
                } if (got.status === 'unresolved')
                    return; const texts = prompt ? c.span_refs.map(sid => { const s = prompt.spans.find(x => x.id === sid); return s ? sq(prompt.raw_text.slice(s.start, s.end)) : ''; }).filter(Boolean) : []; const carried = texts.length > 0 && texts.every(t => itemTexts.some(it => it.includes(t))); if (!carried)
                    unpromoted.push(`${key} — its Finding is ${got.status}, but the sentence (${c.span_refs.join(', ')}) is in no requirement item verbatim`); });
            }
            catch { }
        }
        if (unpromoted.length)
            add('source.candidates', 'traceability', 'fail', `Clarification finding candidates must end in an open user-confirmed Finding or in a requirement item that carries the sentence verbatim: ${unpromoted.join('; ')}`);
    }
    // Prompts cut under an older segmentation rule carry fragment spans that are easy to set aside; take them in again.
    for (const [id, p] of workspace.prompts)
        if ((p.segmentation ?? 1) !== SEGMENTATION_VERSION)
            add(`source.segmentation.${id}`, 'traceability', 'fail', `Prompt ${id} was segmented with rule v${p.segmentation ?? 1}; current is v${SEGMENTATION_VERSION}. Re-run productkit intake.`);
    {
        const forbidden = forbiddenTextIssue(canonicalJson({ definition: definition.items, policies: (await readPolicies(root)).map(p => [p.context, p.actor, p.condition_text, p.action, p.outcome, p.exceptions]), journeys: (await readJourneys(root)).map(j => [j.goal, j.states, j.transitions]), findings: (await readCurrentFindings(root)).map(f => [f.statement, f.questions, f.counterexamples]) }));
        if (forbidden)
            add('text.forbidden', 'structure', 'fail', `Artifact text ${forbidden}.`);
    }
    try {
        await validateDefinitionReferences(root, definition);
        add('definition.references', 'traceability', 'pass', 'Definition references and Decision-to-Prompt lineage are current.');
    }
    catch (e) {
        add('definition.references', 'traceability', 'fail', e instanceof Error ? e.message : 'Definition reference check failed.');
    }
    const existingHashes = new Map(current.snapshot.map(x => [`${x.kind}:${x.ref}`, x.content_hash]));
    for (const id of definition.policy_refs)
        if (!existingHashes.has(`policy:${id}`))
            add(`definition.policy.${id}`, 'traceability', 'fail', `Definition Policy reference does not resolve: ${id}.`);
    for (const id of definition.journey_refs)
        if (!existingHashes.has(`journey:${id}`))
            add(`definition.journey.${id}`, 'traceability', 'fail', `Definition Journey reference does not resolve: ${id}.`);
    for (const id of definition.finding_refs)
        if (!existingHashes.has(`finding:${id}`))
            add(`definition.finding.${id}`, 'traceability', 'fail', `Definition Finding reference does not resolve: ${id}.`);
    for (const id of definition.assumption_refs)
        if (!existingHashes.has(`assumption:${id}`))
            add(`definition.assumption.${id}`, 'traceability', 'fail', `Definition Assumption reference does not resolve: ${id}.`);
    const findings = await readCurrentFindings(root);
    const decisions = await readDecisions(root);
    const applications = await readApplications(root);
    const staleDecisions = await decisionStaleness(root);
    const staleIds = new Set(staleDecisions.map(x => x.decision.id));
    {
        const placed = new Set();
        const policies = await readPolicies(root);
        const journeys = await readJourneys(root); // Only Definition items place a Node. A Policy or Journey citing a Node is
        // not a product statement about it, so it cannot stand in for one.
        void policies;
        void journeys;
        const NORMATIVE = new Set(['functional_requirement', 'nonfunctional_requirement', 'acceptance_criterion']);
        for (const item of definition.items) {
            if (!NORMATIVE.has(item.kind))
                continue;
            const nodes = item.provenance.source_refs.filter(r => r.kind === 'node');
            if (!nodes.length)
                add(`definition.item_source.${item.id}`, 'traceability', 'fail', `${item.kind} item ${item.id} cites no Node; a requirement must come from a modeled Node.`);
            for (const r of nodes)
                placed.add(r.ref);
            // The item carries its Node's sentence verbatim; it may frame it, not rewrite it.
            const squashT = (t) => t.replace(/\s+/g, ' ').trim().replace(/[.。]$/, '');
            for (const r of nodes) {
                const nodeStatement = workspace.nodes.get(r.ref)?.node.statement;
                if (!nodeStatement)
                    continue;
                if (!squashT(item.text).includes(squashT(nodeStatement)))
                    add(`definition.item_restates.${item.id}`, 'traceability', 'fail', `${item.kind} item ${item.id} does not contain the text of ${r.ref} verbatim: "${squashT(nodeStatement).slice(0, 60)}"`);
            }
        }
        for (const item of definition.items)
            if (item.exclusion) {
                const dec = decisions.find(d => d.id === item.exclusion.decision_ref && d.decision_type === 'scope_exclusion' && !staleIds.has(d.id));
                if (dec)
                    for (const r of dec.input_snapshot)
                        if (r.kind === 'node')
                            placed.add(r.ref);
            }
        // An agent-written (proposed) Finding cannot hold a Node out of the
        // Definition; the user must have confirmed the Finding exists.
        for (const f of findings)
            if (f.resolution_status === 'unresolved' && f.review_status === 'confirmed')
                for (const r of f.related_refs)
                    if (r.kind === 'node')
                        placed.add(r.ref);
        const orphans = [...workspace.nodes.keys()].filter(id => !placed.has(id)).sort();
        if (orphans.length)
            add('definition.node_coverage', 'traceability', 'fail', `Nodes neither in the Definition, nor excluded by a scope_exclusion Decision that snapshots them, nor held by an unresolved Finding: ${orphans.join(', ')}`);
        else if (workspace.nodes.size)
            add('definition.node_coverage', 'traceability', 'pass', `All ${workspace.nodes.size} current Node(s) are placed: included, excluded on record, or held by an open Finding.`);
    }
    for (const f of findings) {
        const missing = await validateFindingReferences(root, f);
        const ref = { kind: 'finding', ref: f.id, content_hash: fingerprintHash(current.snapshot, 'finding', f.id) };
        if (missing.length) {
            add(`finding.refs.${f.id}`, 'traceability', 'fail', `Finding ${f.id} has broken references: ${missing.join(', ')}`, [ref]);
            continue;
        }
        if (f.resolution_status === 'unresolved' && f.severity === 'critical') {
            const target = decisions.find(d => d.decision_type === 'scope_exclusion' && d.finding_refs.some(r => r.finding_ref === f.id && r.claim_hash === findingContentHash(toFindingInput(f))) && !staleIds.has(d.id));
            const app = target && applications.find(a => a.plan.decision_ref === target.id && a.status === 'applied' && a.verification_status === 'verified' && !a.verification_history.some(v => v.status === 'stale'));
            const excluded = target && definition.items.some(i => i.kind === 'exclusion' && i.exclusion?.decision_ref === target.id && i.exclusion.excluded_scope === target.scope_exclusion?.excluded_scope && i.exclusion.impact === target.scope_exclusion?.impact && i.exclusion.residual_risk === target.scope_exclusion?.residual_risk);
            if (target && app && excluded)
                add(`finding.${f.id}`, 'finding', 'warn', `Critical Finding remains unresolved; current applied exclusion preserves residual risk (${target.scope_exclusion.residual_risk}).`, [ref]);
            else
                add(`finding.${f.id}`, 'finding', 'fail', `Unresolved Critical Finding ${f.id} blocks approval.`, [ref]);
        }
        else if (f.resolution_status === 'unresolved')
            add(`finding.${f.id}`, 'finding', 'warn', `Finding ${f.id} remains unresolved and requires later review.`, [ref]);
        else {
            const dec = decisions.find(d => d.id === f.decision_ref);
            if (!dec || staleIds.has(dec.id))
                add(`finding.resolution.${f.id}`, 'finding', 'stale', `Finding ${f.id} resolution is missing a current Decision.`, [ref]);
            else if (!dec.finding_refs.some(r => r.finding_ref === f.id && r.claim_hash === findingContentHash(toFindingInput(f))))
                add(`finding.resolution.${f.id}`, 'finding', 'fail', `Finding ${f.id} is ${f.resolution_status} by Decision ${dec.id}, but that Decision does not target this Finding's current claim.`, [ref]);
        }
    }
    for (const f of findings.filter(x => x.severity === 'critical' && ['deferred', 'dismissed'].includes(x.resolution_status))) {
        const target = decisions.find(d => d.id === f.decision_ref && d.decision_type === 'scope_exclusion' && d.finding_refs.some(r => r.finding_ref === f.id && r.claim_hash === findingContentHash(toFindingInput(f))) && !staleIds.has(d.id));
        const app = target && applications.find(a => a.plan.decision_ref === target.id && a.status === 'applied' && a.verification_status === 'verified');
        const retained = target && definition.items.some(i => i.kind === 'exclusion' && i.exclusion?.decision_ref === target.id && i.exclusion.excluded_scope === target.scope_exclusion?.excluded_scope && i.exclusion.impact === target.scope_exclusion?.impact && i.exclusion.residual_risk === target.scope_exclusion?.residual_risk);
        const ref = { kind: 'finding', ref: f.id, content_hash: fingerprintHash(current.snapshot, 'finding', f.id) };
        if (target && app && retained)
            add(`finding.exclusion.${f.id}`, 'finding', 'warn', `Critical Finding ${f.id} is ${f.resolution_status} by explicit scope exclusion; residual risk remains: ${target.scope_exclusion.residual_risk}.`, [ref]);
        else
            add(`finding.exclusion.${f.id}`, 'finding', 'fail', `Critical Finding ${f.id} cannot be ${f.resolution_status} without its matching applied and verified scope-exclusion Decision.`, [ref]);
    }
    const superseded = new Set(decisions.flatMap(d => d.supersedes_decision_ref ? [d.supersedes_decision_ref] : []));
    const proposals = await readProposals(root);
    const supersededProposals = new Set(proposals.flatMap(p => p.supersedes_proposal_ref ? [p.supersedes_proposal_ref] : []));
    for (const proposal of proposals) {
        if (supersededProposals.has(proposal.id))
            continue;
        const selected = decisions.find(d => d.selection.kind === 'proposal_option' && d.selection.proposal_ref === proposal.id && !staleIds.has(d.id) && !superseded.has(d.id));
        const app = selected && applications.find(a => a.plan.decision_ref === selected.id && a.status === 'applied' && a.verification_status === 'verified');
        if (!selected || !app)
            add(`proposal.${proposal.id}`, 'decision', 'fail', `Proposal ${proposal.id} has no currently applied and verified user Decision.`);
    }
    for (const decision of decisions) {
        if (superseded.has(decision.id))
            continue;
        if (staleIds.has(decision.id))
            add(`decision.${decision.id}`, 'decision', 'stale', `Decision ${decision.id} has stale inputs.`);
        else if (!applications.some(a => a.plan.decision_ref === decision.id && a.status === 'applied'))
            add(`decision.${decision.id}`, 'decision', 'fail', `Decision ${decision.id} is not yet applied.`);
    }
    for (const app of applications) {
        const freshness = await applicationFreshness(root, app);
        if (freshness.stale)
            add(`application.${app.id}`, 'application', 'stale', `Application ${app.id} is stale: ${freshness.reasons.join('; ')}`);
        else if (app.status !== 'applied' || app.verification_status !== 'verified')
            add(`application.${app.id}`, 'application', 'fail', `Application ${app.id} must be applied and verified; found ${app.status}/${app.verification_status}.`);
        else
            add(`application.${app.id}`, 'application', 'pass', `Application ${app.id} is applied and current verification is recorded.`);
    }
    const journeys = await readJourneys(root);
    for (const j of journeys) {
        {
            const sqj = (t) => t.replace(/\s+/g, ' ').trim().replace(/[.。]$/, '');
            const body = sqj([j.goal, ...j.acceptance_criteria].join(' '));
            const missingNode = j.provenance.source_refs.filter(r => r.kind === 'node').map(r => r.ref).filter(n => { const t = workspace.nodes.get(n)?.node.statement; return t && !body.includes(sqj(t)); });
            if (missingNode.length)
                add(`journey.source.${j.id}`, 'journey', 'fail', `Journey ${j.id} does not carry the text of its source Node(s) verbatim in goal/acceptance_criteria: ${missingNode.join(', ')}`);
        }
        const states = new Set(j.states);
        const reachable = new Set([j.entry_state]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const t of j.transitions)
                if (reachable.has(t.from) && !reachable.has(t.to)) {
                    reachable.add(t.to);
                    changed = true;
                }
        }
        const reverse = new Map();
        for (const t of j.transitions)
            reverse.set(t.to, [...(reverse.get(t.to) ?? []), t.from]);
        const canEnd = new Set(j.terminal_states);
        changed = true;
        while (changed) {
            changed = false;
            for (const [to, froms] of reverse)
                if (canEnd.has(to))
                    for (const from of froms)
                        if (!canEnd.has(from)) {
                            canEnd.add(from);
                            changed = true;
                        }
        }
        const bad = j.transitions.some(t => !states.has(t.from) || !states.has(t.to));
        const unreachable = [...reachable].filter(s => !canEnd.has(s));
        add(`journey.${j.id}`, 'journey', bad || unreachable.length ? 'fail' : j.acceptance_criteria.length ? 'pass' : 'fail', bad ? 'Journey contains an unknown transition state.' : unreachable.length ? `Reachable states cannot reach a terminal: ${unreachable.join(', ')}` : j.acceptance_criteria.length ? 'Journey state graph and acceptance criteria are present.' : 'Journey acceptance criteria are missing.');
    }
    for (const p of await readPolicies(root)) {
        try {
            await validatePolicyReferences(root, p);
            const sqp = (t) => t.replace(/\s+/g, ' ').trim().replace(/[.。]$/, '');
            const body = sqp([p.context, p.condition_text, p.action, p.outcome, ...p.exceptions.map(e => e.statement)].join(' '));
            const missingNode = p.provenance.source_refs.filter(r => r.kind === 'node').map(r => r.ref).filter(n => { const t = workspace.nodes.get(n)?.node.statement; return t && !body.includes(sqp(t)); });
            if (missingNode.length)
                add(`policy.${p.id}`, 'policy', 'fail', `Policy ${p.id} does not carry the text of its source Node(s) verbatim in context/condition/action/outcome/exceptions: ${missingNode.join(', ')}`);
            else
                add(`policy.${p.id}`, 'policy', 'pass', `Policy ${p.id} structure and provenance are valid and it carries its source Node text; semantics remain subject to review.`);
        }
        catch (e) {
            add(`policy.${p.id}`, 'policy', 'fail', e instanceof Error ? e.message : 'Policy validation failed.');
        }
    }
    for (const a of await readAssumptions(root)) {
        if (a.status === 'disproven' || a.risk === 'critical' && a.status === 'unverified')
            add(`assumption.${a.id}`, 'assumption', 'fail', `Critical or disproven Assumption ${a.id} blocks readiness.`);
        else if (a.status === 'unverified')
            add(`assumption.${a.id}`, 'assumption', 'warn', `Assumption ${a.id} remains unverified.`);
    }
    for (const ref of current.snapshot.filter(x => x.kind === 'impact_report')) {
        const report = await findImpact(root, ref.ref);
        if (report && report.completeness !== 'complete')
            add(`impact.${ref.ref}`, 'impact', 'warn', `ImpactReport ${ref.ref} is incomplete; blocked and unreviewed inputs remain visible.`, [ref]);
    }
    const runs = await readChallengeRuns(root);
    if (!runs.length)
        add('challenge.coverage', 'semantic', 'fail', 'No ChallengeRun exists for current requirements.');
    else {
        const states = await Promise.all(runs.map(async (run) => ({ run, fresh: await refreshChallengeRun(root, run), missing: await validateChallengeRunReferences(root, run) })));
        const complete = states.find(x => !x.fresh.stale && !x.missing.length && x.run.status === 'complete' && x.fresh.completion === 'complete');
        const current = states.find(x => !x.fresh.stale && !x.missing.length);
        const selected = complete ?? current ?? states.at(-1);
        if (complete)
            add(`challenge.${complete.run.id}`, 'semantic', 'pass', 'ChallengeRun coverage is complete; this does not establish semantic correctness.');
        else if (selected.fresh.stale || selected.missing.length)
            add(`challenge.${selected.run.id}`, 'semantic', 'stale', `ChallengeRun is stale or has unresolved refs${selected.missing.length ? `: ${selected.missing.join(', ')}` : ''}.`);
        else
            add(`challenge.${selected.run.id}`, 'semantic', 'fail', 'Current ChallengeRun coverage is incomplete.');
    }
    let semantic = 'not_assessed';
    if (review) {
        const areas = Object.values(review.areas);
        const currentRef = review.definition_ref === definition.id && review.definition_hash === definition.content_hash && review.input_fingerprint === current.fingerprint;
        const hollow = semanticReviewIssue(review, new Set(current.snapshot.map(r => r.kind))) ?? fidelityIssue(review, definition, [...(await readPolicies(root)).filter(p => definition.policy_refs.includes(p.id)), ...(await readJourneys(root)).filter(j => definition.journey_refs.includes(j.id))]) ?? await carryOverIssue(root, review);
        const contradictions = review.item_fidelity.filter(f => f.verdict === 'contradicts');
        for (const f of contradictions)
            add(`definition.fidelity.${f.item_ref}`, 'traceability', 'fail', `Definition item ${f.item_ref} contradicts its source ${f.node_ref}: ${f.reason}`);
        for (const f of review.item_fidelity.filter(f => f.verdict === 'narrower' || f.verdict === 'broader'))
            add(`definition.fidelity.${f.item_ref}`, 'traceability', 'warn', `Definition item ${f.item_ref} is ${f.verdict} than its source ${f.node_ref}: ${f.reason}`);
        semantic = currentRef ? areas.every(a => a.status !== 'not_reviewed') && review.unreviewed_scope.length === 0 && !hollow ? 'pass' : 'inconclusive' : 'stale';
        add(`semantic.${review.id}`, 'semantic', semantic === 'pass' ? 'pass' : semantic === 'stale' ? 'stale' : 'fail', semantic === 'pass' ? 'Semantic review record covers all required areas with cited evidence and reports no unreviewed scope.' : semantic === 'stale' ? 'Semantic review inputs are stale.' : hollow ? `Semantic review is hollow: ${hollow}` : 'Semantic review is incomplete or has unreviewed scope.', []);
    }
    else
        add('semantic.review', 'semantic', 'not_assessed', 'No semantic review is recorded for the current snapshot.');
    if (checks.length === 0)
        add('baseline', 'structure', 'pass', 'No additional checks required.');
    return { checks, snapshot: current.snapshot, fingerprint: current.fingerprint, definition_id: definition.id, definition_hash: definition.content_hash, semantic };
}
function fingerprintHash(snapshot, kind, ref) { return snapshot.find(x => x.kind === kind && x.ref === ref)?.content_hash ?? '0'.repeat(64); }
async function findImpact(root, id) { for (const sub of ['graph', 'graph/reports'])
    for (const f of await files(path.join(root, sub))) {
        try {
            const p = parseImpactReport(await readFile(path.join(root, sub, f), 'utf8'));
            if (p.analysis_id === id)
                return p;
        }
        catch { }
    } return undefined; }
export async function createValidationReport(root, reviewId, now = new Date()) { let review; if (reviewId) {
    const f = path.join(root, dirs.semantic, `${reviewId}.yaml`);
    review = semanticReviewSchema.parse(await readYaml(f));
}
else {
    const all = await files(path.join(root, dirs.semantic));
    if (all.length) {
        const reviews = await Promise.all(all.map(async (f) => semanticReviewSchema.parse(await readYaml(path.join(root, dirs.semantic, f)))));
        const fingerprint = (await currentValidationFingerprint(root)).fingerprint;
        review = reviews.filter(x => x.input_fingerprint === fingerprint).sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1) ?? reviews.sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
    }
} const result = await checksFor(root, review); const structural = result.checks.some(c => ['structure', 'traceability', 'decision', 'application', 'journey', 'policy', 'assumption', 'impact', 'finding'].includes(c.category) && ['fail', 'stale'].includes(c.status)) ? 'blocked' : 'pass'; const readiness = structural === 'blocked' || result.semantic !== 'pass' || result.checks.some(c => c.status === 'fail' || c.status === 'stale' || c.status === 'not_assessed') ? 'blocked' : 'ready'; const body = { schema_version: 1, definition_ref: result.definition_id, definition_hash: result.definition_hash, rules_version: 'validation-rules-v2', input_snapshot: result.snapshot, input_fingerprint: result.fingerprint, checks: result.checks, structural_status: structural, semantic_status: result.semantic, readiness: readiness, ...(review ? { review_ref: review.id } : {}) }; const report_hash = sha256Hex(canonicalJson(body)); const report = validationReportSchema.parse({ ...body, report_hash, id: `VAL-${report_hash.slice(0, 16)}`, created_at: now.toISOString() }); const dir = path.join(root, dirs.validations); await mkdir(dir, { recursive: true }); const file = path.join(dir, `${report.id}.yaml`); if (await atomicCreateFile(file, stringify(report)))
    return report; const old = validationReportSchema.parse(await readYaml(file)); if (old.report_hash !== report.report_hash)
    throw new CliError('Validation report ID collision.', ExitCode.GATE_BLOCKED); return old; }
export async function readValidationReports(root) { const out = []; for (const f of await files(path.join(root, dirs.validations)))
    out.push(validationReportSchema.parse(await readYaml(path.join(root, dirs.validations, f)))); return out; }
export async function reportFreshness(root, report) { const current = await currentValidationFingerprint(root, report.rules_version); return current.fingerprint !== report.input_fingerprint || !(await readDefinition(root))?.content_hash || (await readDefinition(root)).content_hash !== report.definition_hash; }
export async function recordApproval(root, reportId, userStatement, scope, attestation = 'flag', now = new Date()) { if (!userStatement.trim() || !scope.trim())
    throw new CliError('Explicit user statement and scope are required.', ExitCode.GATE_BLOCKED); if (saysNo(userStatement))
    throw new CliError(`The approval statement reads as a refusal: "${userStatement.trim().slice(0, 60)}". An approval must not say no.`, ExitCode.GATE_BLOCKED); const policy = await readAttestationPolicy(root); if (!policy.declared)
    throw new CliError('config.yaml declares no attestation policy; add `attestation: tty` or `attestation: flag` before approving.', ExitCode.GATE_BLOCKED); if (policy.policy === 'tty' && attestation !== 'tty')
    throw new CliError('This workspace requires the approval statement to be typed on a terminal (config attestation: tty).', ExitCode.GATE_BLOCKED, ['Run `productkit approve record --validation <id> --scope <scope>` without --user-statement, in a terminal, and type the statement when asked.', 'An agent cannot do this step; hand the command to the user.']); const report = (await readValidationReports(root)).find(x => x.id === reportId); if (!report)
    throw new CliError(`ValidationReport ${reportId} not found.`, ExitCode.GATE_BLOCKED); if (await reportFreshness(root, report) || report.readiness !== 'ready')
    throw new CliError('Only a current ready ValidationReport can be approved.', ExitCode.GATE_BLOCKED); const definition = await readDefinition(root); if (!definition || definition.id !== report.definition_ref || definition.content_hash !== report.definition_hash)
    throw new CliError('Approval target Definition is stale.', ExitCode.GATE_BLOCKED); const approvals = await readApprovals(root); const same = approvals.find(a => a.definition_ref === definition.id && a.definition_hash === definition.content_hash && a.validation_ref === report.id && a.validation_hash === report.report_hash && a.input_fingerprint === report.input_fingerprint && a.user_statement === userStatement.trim() && a.scope === scope.trim() && a.attestation === attestation); if (same)
    return same; const chain = currentApprovalHead(approvals); if (chain.issue)
    throw new CliError(`Approval history is inconsistent: ${chain.issue}`, ExitCode.GATE_BLOCKED); const prev = chain.head; const base = { schema_version: 1, definition_ref: definition.id, definition_hash: definition.content_hash, validation_ref: report.id, validation_hash: report.report_hash, input_fingerprint: report.input_fingerprint, user_statement: userStatement.trim(), scope: scope.trim(), attestation, ...(prev ? { supersedes_ref: prev.id } : {}) }; const entry_hash = sha256Hex(canonicalJson(base)); const approval = approvalSchema.parse({ ...base, entry_hash, id: `APR-${entry_hash.slice(0, 16)}`, created_at: now.toISOString() }); const dir = path.join(root, dirs.approvals); await mkdir(dir, { recursive: true }); const file = path.join(dir, `${approval.id}.yaml`); if (await atomicCreateFile(file, stringify(approval)))
    return approval; const old = approvalSchema.parse(await readYaml(file)); if (old.entry_hash !== entry_hash)
    throw new CliError('Approval ID collision.', ExitCode.GATE_BLOCKED); return old; }
export async function readApprovals(root) { const out = []; for (const f of await files(path.join(root, dirs.approvals)))
    out.push(approvalSchema.parse(await readYaml(path.join(root, dirs.approvals, f)))); return out; }
/** The current Approval is the one no other Approval supersedes. Two heads, or a head whose supersedes_ref does not resolve, is a forged or orphaned record. */
export function currentApprovalHead(approvals) { if (!approvals.length)
    return {}; const ids = new Set(approvals.map(a => a.id)); for (const a of approvals)
    if (a.supersedes_ref && !ids.has(a.supersedes_ref))
        return { issue: `Approval ${a.id} supersedes ${a.supersedes_ref}, which does not exist.` }; const superseded = new Set(approvals.flatMap(a => a.supersedes_ref ? [a.supersedes_ref] : [])); const heads = approvals.filter(a => !superseded.has(a.id)); if (heads.length !== 1)
    return { issue: `Expected one current Approval; found ${heads.length} not superseded: ${heads.map(a => a.id).join(', ')}.` }; return { head: heads[0] }; }
export async function approvalStatus(root) { const approvals = await readApprovals(root); const { head: approval, issue } = currentApprovalHead(approvals); if (!approval)
    return issue ? { status: 'stale', approval: approvals[0], issue } : { status: 'missing' }; const reports = await readValidationReports(root); const report = reports.find(x => x.id === approval.validation_ref); const definition = await readDefinition(root); if (!report || report.report_hash !== approval.validation_hash || report.readiness !== 'ready' || report.definition_ref !== approval.definition_ref || report.definition_hash !== approval.definition_hash || report.input_fingerprint !== approval.input_fingerprint || !definition || definition.id !== approval.definition_ref || definition.content_hash !== approval.definition_hash || await reportFreshness(root, report))
    return { status: 'stale', approval }; return { status: 'valid', approval }; }
//# sourceMappingURL=validation-store.js.map