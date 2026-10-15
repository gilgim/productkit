---
name: productkit-validate
description: Run `productkit validate`, inspect blocking/stale/unreviewed items, and guide user approval of the Product Definition.
---

# ProductKit Validation & Approval

Use this skill after Change 07 has produced a draft Product Definition.

1. Run `productkit validate` and inspect every blocking, warning, stale, and unreviewed input.
2. Read the current Definition, Journey, Policy, Findings, Decisions, Applications, Graph/Impact reports, Assumptions, and current ChallengeRun.
3. Review the eight required areas: requirement completeness, user flow, policy consistency, acceptance criteria, assumptions, graph/impact, traceability, and counterexamples. An area marked `reviewed` must cite at least one product artifact in `evidence_refs` (Definition, Node, Finding, Decision, Policy, Journey, ImpactReport, ChallengeRun, Prompt). The skill file and the workspace fingerprint are not evidence. The CLI refuses a review with an empty or skill-only `evidence_refs`; it does not check that the cited artifact is the right one for that area — that is on you.
   State the reviewed scope and every item not reviewed in `unreviewed_scope`. Do not move an unreviewed item into `uncertainty` to make `unreviewed_scope` empty; readiness that rests on a redefined scope is not readiness. Compare the Definition against the Prompt text directly, not only against the Nodes; `source.coverage` and `definition.node_coverage` catch structural omission, not a span dispositioned as non_requirement by mistake or a distorted item.
4. For each suspected defect, separate observed evidence from a hypothetical counterexample. Submit it through the existing Finding process; do not set Finding resolution or claim all defects were found.
5. Bind the assessment to the current Definition hash and fingerprint printed/derived by the current CLI API. Record it with `productkit validate review --input <yaml>`; do not claim this proves semantic correctness.
6. Re-run `productkit validate --review <id>`. Report machine status separately from semantic assessment. Never create or imply user approval.
7. Approval is typed by the user, not passed by you. Show the user: `productkit approve record --validation <id> --scope <scope>` (no `--user-statement`) and stop. The CLI reads the statement from the user's terminal; run by you it fails with "No terminal is attached", which is the intended outcome. Only when `product/config.yaml` says `attestation: flag` may you pass `--user-statement <verbatim response>`; the report then carries a warning. Never edit that config line. If no user response exists, stop with approval missing.

The CLI validates schemas, references, and hashes. It cannot authenticate the speaker or establish that a user's statement is true. A PASS is not evidence of semantic completeness.
