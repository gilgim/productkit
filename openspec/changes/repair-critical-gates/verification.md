# Critical Gate Repair Verification

## Result

All three reported defects reproduced against the pre-change implementation and are blocked by the repaired gates. This is a code and synthetic CLI verification result; it is not a real user or Claude Agent approval/evaluation. Change 04 implementation was not resumed.

## Defect reproduction

| Defect | Reproduction input | Expected | Before | Root cause / affected contract | Fix |
|---|---|---|---|---|---|
| Empty clarification accepted | Valid Prompt; all five stored step arrays empty; an `agreed` interpretation entry whose `presented_hash` matches the empty steps | BLOCKED because six-step completion evidence is absent | `clarify` printed `Clarification confirmed`; the gate treated a matching hash and agreement status as sufficient | `judgeCompletion` checked the snapshot/agreement but did not require substantive step outputs. Change 02 `prompt-intake-and-clarification` completion contract | `judgeCompletion` audits substantive outputs, inter-step references, no-candidate review reasons, placeholders, and actual Prompt binding before accepting confirmation |
| `split_required` Node modeled | Complete synthetic Clarification; Node has `atomicity.final=split_required`; group says `modeled` | BLOCKED until replacement Nodes are created and reviewed | `model` printed `NodeGroup modeled` | `judgeNodeSetCompletion` did not prohibit a final split-required Node. Change 03 `atomic-node-modeling` atomic final contract | Every final Node must be `atomic`; split history is retained as retired Node records with new child IDs and lineage; coverage and preservation review are checked |
| Prompt reference/source edits ignored | Confirmed CLR and modeled group with nonexistent Prompt ID, then separately mutate the referenced Prompt raw text without updating its stored hash | BLOCKED; downstream completion must be stale | Before: missing Prompt still confirmed/modeled; changed Prompt still confirmed/modeled | The old judge path did not load and verify the actual Prompt source. Change 02 Prompt provenance and Change 03 source freshness contracts | CLI loads the referenced Prompt, checks identity, schema, raw hash and deterministic spans; Clarification stores Prompt hash and NodeGroup stores the full CLR snapshot hash |

The `changed_clarification` control case was already rejected before repair when its steps changed after agreement. That existing protection remains in place and is covered by regression tests.

## Changes

Implementation and test changes are enumerated with before/after SHA-256 values in [changed-files.json](evidence/changed-files.json). The related artifacts are:

- Clarification schema, completion audit, Prompt integrity and workspace source loading/update behavior.
- Node and NodeGroup schemas, source/snapshot freshness checks, split lineage and preservation review.
- CLI `clarify` and `model` integration and user-facing blocked reasons.
- Regression fixtures and tests, including a separate-process built-CLI E2E suite.
- This additive OpenSpec correction change. Existing Change 02/03 histories, official docs, Skills, and Change 04 artifacts were not rewritten.

No existing Prompt, Clarification, or NodeGroup content is automatically repaired, overwritten, or deleted. Draft-compatible parsing remains possible, but missing historical evidence fails closed at completion and requires renewed review.

## Before/after verification

- Baseline before edits: `npm test` passed 136/136 existing tests. Regression tests were then added and confirmed red against the original gate behavior before fixes.
- Final: `npm run typecheck` PASS; `npm run build` PASS; `npm test` PASS, 177 tests across 12 files (136 pre-existing cases plus 41 new cases).
- OpenSpec Strict Validation: `repair-critical-gates`, `prompt-intake-and-clarification`, `atomic-node-modeling`, and `graph-and-impact-analysis` PASS. The existing informational archive note for the latter two says the `product-workspace` main spec does not yet exist; no archive was run.
- Separate-process CLI differential: six synthetic scenarios were run against a separately compiled pre-change CLI and the current built CLI: empty clarification, valid baseline, split-required Node, missing Prompt, changed Prompt raw text, and changed Clarification. Before, the first, third, fourth, and fifth scenarios could report false completion (with the changed-Clarification control already blocked); after, all five invalid/stale cases are blocked and the valid case completes. The 12 result records and artifact-preservation booleans are in [cli-before-after.json](evidence/cli-before-after.json). All test confirmations are explicitly synthetic (`SYNTHETIC TEST ONLY`).
- Regression suite includes the requested empty-plus-agreed BLOCKED, valid six-step/hash confirmation, split-required BLOCKED, split-and-revalidate, missing Prompt, Prompt raw edit invalidation, CLR edit invalidation, and normal-data regression scenarios. CLI tests invoke the built executable in separate processes and verify artifacts remain unchanged.

## Final Gate contracts

**Clarification.** Completion requires valid substantive output for each of the six conceptual stages (including an explicit, non-placeholder review reason when relation/counterexample candidates are absent), valid cross-step references, current actual Prompt identity/hash/spans, and an explicit agreed entry whose presented snapshot hash equals current clarification content. Empty fields or mere field presence do not pass. The CLI checks structure and hash consistency; it cannot prove semantic fidelity, statement truth, or that a real person made the recorded utterance.

**Atomicity.** Modeled requires complete decomposition coverage, unique/resolving Node references, every final Node to have `atomicity.final=atomic` with consistent sub-verdicts, no open important finding, and recorded condition/operator/exception preservation review for each decomposition item. A `split_required` or uncertain final Node blocks. Splitting requires preserving the old Node in retired history and creating traceable replacement Nodes; editing the old verdict to `atomic` is rejected by the consistency checks. These checks validate the record structure, not the semantic correctness of an AI judgment.

**Traceability/freshness.** Prompt → Clarification → NodeGroup → Node references must resolve to the current source IDs and snapshots. A raw Prompt or Clarification content change invalidates relevant descendants for completion. The CLI reports stale/missing sources and preserves stored content; it does not silently rewrite it. Hashes detect mismatch, not authorship or tamper-proof consent.

## Remaining risks and release gate

- Placeholder detection is structural and uses a finite set; it cannot detect every meaningless sentence or establish that prose is substantively correct.
- Hash records are consistency checks, not proof that user statements are genuine. All executed confirmation scenarios were synthetic; no real user approval was fabricated or inferred.
- Legacy artifacts without the newly required snapshots/review records fail closed and need human review. No automatic migration was added.
- Existing Skills were outside the authorized scope and were not changed. A real Claude Code Agent/Skill evaluation remains outstanding, so compatibility with its generated output is not established by CLI tests.
- Change 04's implementation remains **NO-GO pending its separately required agent/user validation and approval**. This repair does not automatically resume Change 04.

No Change 04 implementation, OpenSpec Apply/Archive, Commit, Push, or PR was performed.
