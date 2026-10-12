# Tasks

## 1. Proposal contract and persistence

- [x] 1.1 Add Proposal/Option schemas with many-to-many Finding coverage, typed evidence and target refs, trade-offs, residual issues, AI recommendation, snapshot hashes, immutable claim hash, and history; verify valid/invalid fixtures with `tests/proposal-decision.test.ts`.
- [x] 1.2 Add deterministic Proposal IDs, exact-input idempotency, stale Finding/snapshot rejection, explicit supersedes revisions, and safe file persistence; verify multiple Proposals per Finding and multi-Finding Proposal cases.
- [x] 1.3 Add Proposal store reference validation for current Finding claim/review status, Node/Graph/Impact inputs, and option coverage per Finding; verify unresolved/stale refs block without changing existing bytes.
- [x] 1.4 Document Proposal fields and recommendation-vs-choice semantics in `docs/artifact-contracts.md`; validate the documented YAML example against the executable schema.

## 2. Decision contract and user choice

- [x] 2.1 Add immutable Decision schema for `content_decision` and `scope_exclusion`, Proposal option or direct-user choice, explicit Finding targets, exact user statement, rationale, scope, typed source refs, snapshot hashes, time, and history; verify required-field and hash tests.
- [x] 2.2 Add CLI paths for choosing a listed option and recording a direct user decision; verify omitted user statement/rationale and agent-only selection are rejected.
- [x] 2.3 Add deterministic Decision IDs, exact rerun idempotency, explicit supersedes links, and conflict detection for overlapping active decisions; verify prior Decision bytes and history remain intact.
- [x] 2.4 Validate referenced Proposal/option/Finding and current Finding claim hashes before Decision creation; verify unrelated Decision refs cannot target or resolve another Finding.
- [x] 2.5 Document confirmation authenticity limits and Decision records in `docs/artifact-contracts.md`; validate sample selected-option and direct-decision records.

## 3. Decision boundary, Finding state preservation, and Critical protection

- [x] 3.1 Record every new Decision as `pending_application` and reject Change 06 attempts to mark it applied; verify no application artifact is created by these commands.
- [x] 3.2 Preserve Finding `review_status`, `resolution_status`, confirmation, and history; reject all Change 06 resolution transitions, including resolved/deferred/dismissed, and verify Decision creation alone changes no Finding bytes.
- [x] 3.3 Enforce Critical Finding rules: no AI-only decision, no unrelated target, and scope exclusion requires explicit user statement, target hash, excluded scope, impact, rationale, and residual risk; verify Finding stays unresolved.
- [x] 3.4 Add Assumption records and state transitions for unverified/verified/disproven/accepted_risk; verify accepted_risk requires an explicit Decision and never becomes verified by acceptance.
- [x] 3.5 Document pending application, unchanged Finding state, Critical residual risk, and Assumption contract; verify examples and Change 07/08 boundary wording.

## 4. CLI, Agent Skill, and lifecycle safety

- [x] 4.1 Add `productkit propose`/Proposal validation and `productkit decide` commands without LLM calls; verify help, exit codes, explicit user-input options, and no AI-authored Decision path.
- [x] 4.2 Add `skills/propose/SKILL.md` for input review, option/trade-off presentation, exact user choice capture, direct choices, Critical scope exclusion, and the pending-application handoff; review a synthetic walkthrough and label it as simulated.
- [x] 4.3 Add typed reference, current hash, stale dependency, duplicate/conflict, and Node/Graph/Policy snapshot stale reporting; verify changed-input refs are shown and unrelated graph edges are not blindly traversed.
- [x] 4.4 Add deterministic resumable Proposal/Decision creation with atomic no-overwrite persistence; verify interrupted/retried submission, duplicate execution, supersedes history, and byte-for-byte preservation on write failure. Do not create Application or Resolution records.
- [x] 4.5 Align `docs/architecture.md`, `docs/artifact-contracts.md`, and `docs/roadmap.md` with the implemented state transitions and Change 07/08 ownership; run the documented commands in a temporary workspace.

## 5. Acceptance and regression verification

- [x] 5.1 Test one Finding with multiple options and one Proposal covering multiple Findings with per-Finding coverage.
- [x] 5.2 Test explicit user option selection, direct user decision, and rejection of AI-only Decision creation; label synthetic user input as mock data.
- [x] 5.3 Test unrelated Decision rejection, every Change 06 Finding-resolution transition blocked, Critical auto-defer/dismiss block, explicit scope exclusion, and preserved unresolved status/residual risk.
- [x] 5.4 Test Finding changes staling Proposal/Decision, superseding Decision preserving prior records, option/Decision consistency, and duplicate/conflicting Decision handling.
- [x] 5.5 Test interrupted/retried submission, repeat execution idempotency, and atomic write failure preserving prior artifact bytes.
- [x] 5.6 Separate deterministic schema/reference/hash/state tests from AI semantic evaluation; check actual Agent availability and report UNKNOWN when credentials/tools are unavailable.
- [x] 5.7 Run Change 01~05 regression suite, built CLI E2E, `npm run typecheck`, `npm run build`, `npm test`, and OpenSpec Strict Validation; record each result without treating structural PASS as semantic correctness. Full suite includes prior Change 01~05 regression tests; 229 tests passed.
