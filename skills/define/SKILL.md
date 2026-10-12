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
5. Structure policies as Context, Actor, Condition, Action, Outcome, Exceptions, and Priority. Use only the supported condition AST. Priority must cite a current user Decision. Never infer precedence from an `exception_of` edge.
6. Review policy pairs for conflict, exception, replacement, duplicate, independent constraints, and inconclusive cases. A shared condition region alone does not prove conflict. Record semantic concerns as proposed Finding candidates with evidence, counterexamples, and uncertainty; do not claim they are confirmed.
7. Preserve explicit scope exclusions and their residual risk. Keep unresolved Critical Findings and accepted-risk Assumptions visible.
8. Draft an Application preview only when a current explicit Decision calls for applying a change. Report all target hashes and before/after impact evidence; never claim applied until the CLI verifies every target after hash.
9. Run CLI structural validation and report errors, blocked inputs, stale data, unreviewed scope, and semantic uncertainties separately.

## Output

Create draft YAML inputs under `product/` and use the CLI to validate/persist them. Do not directly edit Finding status, Decision records, approval records, or source Prompt/Clarification/Node artifacts. Do not delete or overwrite prior versions.

## Questions and stop conditions

Ask the user when a product commitment, exception scope, priority, unresolved Finding, or Decision interpretation is missing. Leave the item unresolved. Do not fabricate a user response or declare the Definition approved.

## Completion

Report the Definition and artifact IDs, provenance snapshot, policy conflict candidates, residual risks, blocked/unreviewed scope, and CLI structural status. A structural PASS is not evidence of semantic completeness or final approval.
