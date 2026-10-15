---
name: productkit-define
description: Turn current, hash-valid Nodes and explicit user Decisions into a draft Product Definition, Journeys, Policies and Acceptance Criteria.
---

# Product Definition and Policy Skill

## Purpose

Turn current, hash-valid Nodes and explicit user Decisions into a draft Product Definition, Journeys, Policies, and Acceptance Criteria. This skill performs semantic analysis; the CLI only checks structure, references, hashes, supported condition syntax, and application state.

## Inputs

- `product/sources/`, `product/discovery/`, `product/nodes/`, `product/graph/`
- Current Findings, Proposals, Decisions, Assumptions, and any existing Definition/Journey/Policy
- `productkit define status`, `productkit graph validate`, and relevant `productkit graph impact` output

## Workflow

1. Establish the requested Definition scope and identify every included and excluded input.
2. Read current Prompt, Clarification, NodeGroup/Node, Graph/ImpactReport, Finding, Decision, and Assumption records. Stop on stale or unresolved references.
3. Separate source statements, AI inferences, and explicit user Decisions. Every normative Definition item must cite a current Decision and a resolvable path to its source Prompt. Preserve Nodes as evidence; do not turn inference into a user commitment.
4. Draft goals, scope, stakeholders, functional and non-functional requirements, Journeys, policies, edge cases, and testable Acceptance Criteria. Keep the user's condition grouping, quantities, units, time scope, audience, and exception coverage intact. If uncertain, retain the source text and ask a question.
5. Every text field of a Policy (`context`, `condition_text`, `action`, `outcome`, each exception `statement`) and of a Journey (`goal`, each acceptance criterion) must be its source Node's sentence or a cited Decision's `user_statement`, verbatim — the CLI rejects any other text. A Policy cites exactly one Node; `actor` and a Journey's states/triggers are words taken from those sentences; numbers in the structured `condition` must appear in `condition_text`. A Definition item may likewise be a cited Decision's words with no Node. Structure policies as Context, Actor, Condition, Action, Outcome, Exceptions, and Priority. Use only the supported condition AST. Priority must cite a current user Decision. Never infer precedence from an `exception_of` edge.
6. Review policy pairs for conflict, exception, replacement, duplicate, independent constraints, and inconclusive cases. A shared condition region alone does not prove conflict. Record semantic concerns as proposed Finding candidates with evidence, counterexamples, and uncertainty; do not claim they are confirmed.
7. Place every current Node (Constitution 11). Each Node must end up in exactly one of: a Definition item / Policy / Journey `source_refs`; a `scope_exclusion` Decision whose `input_snapshot` lists the Node, with a matching `exclusion` item; or an unresolved Finding whose `related_refs` name the Node. The CLI check `definition.node_coverage` lists any Node that is in none of these and blocks readiness. "Only the core items" is not a placement; it is an omission.
8. An `exclusion` item must cite its `scope_exclusion` Decision in `exclusion.decision_ref` and in `provenance.decision_refs`, and repeat `excluded_scope`, `impact` and `residual_risk` verbatim from that Decision. `excluded_scope` is the excluded Node sentence(s) verbatim (sorted by Node id, joined with a space), so the export names what left in the user's own words. The CLI rejects an exclusion whose Decision does not resolve, is not current, or says something else.
9. The Definition must contain at least one `functional_requirement`, `nonfunctional_requirement` or `acceptance_criterion` item. Goals, scope and Policies alone do not pass `definition.normative`. Each of those items must cite at least one Node and its `text` must read **exactly** as that Node's statement (several Nodes: their statements in order, space-joined), optionally after the prefix `검증:` / `AC:` / `수락 기준:`. No other framing — "다음은 하지 않는다: …" is not expressible; `definition.item_source` and `definition.item_restates` check this. Only these three kinds place a Node; goal/scope/stakeholder items do not.
10. Preserve explicit scope exclusions and their residual risk. Keep unresolved Critical Findings and accepted-risk Assumptions visible.
11. **Use `productkit define draft --decision <DEC> --input <yaml>`.** The input holds `scope`, `rationale`, and what this Decision changes: `definition: {product_name, items: [{kind, text, provenance: {source_refs: [{kind: node, ref}], decision_refs: [{kind: decision, ref}]}}]}` (always the full item list), `policies: [...]`, `journeys: [...]` — written without ids, content hashes, provenance hashes, snapshots or ImpactReports: the CLI fills all of those, plans, and applies in one step (an item or Journey whose text is the Decision's words cites no Node; the CLI cites the Decision's Finding for it). Then `productkit define application verify <APP> --input` (status, assessor, summary, evidence_refs, uncertainty — at least one uncertainty line) and `productkit decide resolve <DEC>`. One draft per Decision; a later draft that rewrites definition.yaml is a chain, not drift. The low-level path, `productkit define application plan --input` (shape `productkit schema application-plan`; `after_content` hashes and the Definition/Policy/Journey records themselves come from `productkit hash policy|journey|definition --input`; `before_impact_refs` lists exactly the ImpactReports of the Nodes this Application changes, saved with `productkit graph impact --node <id> --output …`), then `apply <APP>`, then `verify <APP> --input` (status/assessor/summary/evidence_refs/uncertainty), then `productkit decide resolve <DEC>` for the Decision it carried. One Application cites one Decision. A plan that will not be applied is closed with `productkit define application cancel <APP>`; never delete the file. Draft an Application preview only when a current explicit Decision calls for applying a change. Report all target hashes and before/after impact evidence; never claim applied until the CLI verifies every target after hash.
12. Run CLI structural validation and report errors, blocked inputs, stale data, unreviewed scope, and semantic uncertainties separately.

## Output

Create draft YAML inputs under `product/` and use the CLI to validate/persist them. Do not directly edit Finding status, Decision records, approval records, or source Prompt/Clarification/Node artifacts. Do not delete or overwrite prior versions.

## Questions and stop conditions

Ask the user when a product commitment, exception scope, priority, unresolved Finding, or Decision interpretation is missing. Leave the item unresolved. Do not fabricate a user response or declare the Definition approved.

## Completion

Report the Definition and artifact IDs, provenance snapshot, policy conflict candidates, residual risks, blocked/unreviewed scope, and CLI structural status. A structural PASS is not evidence of semantic completeness or final approval.
