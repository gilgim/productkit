# Tasks

## 1. Contracts and snapshot inventory

- [x] 1.1 Add versioned ValidationReport, semantic review, Approval, check-result, and history schemas with deterministic content/input hashes and replay-safe IDs.
- [x] 1.2 Implement a closed inventory of current Change 01–07 artifacts and canonical snapshot fingerprinting; report unknown/unreviewed inputs without self-referencing reports or approvals.
- [x] 1.3 Add reference validators for Prompt-to-Definition provenance, Finding/Assumption, Proposal/Decision, Application, Graph/Impact, Journey, and Policy inputs; never mutate upstream artifacts.

## 2. Readiness checks

- [x] 2.1 Implement current schema/reference/hash/stale checks and explicit structural status independent from semantic assessment.
- [x] 2.2 Implement Finding/Critical scope-exclusion, pending Decision, Application applied/verified, and residual-risk checks without silently changing Finding states.
- [x] 2.3 Implement Journey graph reachability, Acceptance Criteria presence, Assumption severity, bounded Policy analysis, and Impact completeness checks.
- [x] 2.4 Implement required semantic review areas, evidence/unreviewed scope, and snapshot staleness handling.
- [x] 2.5 Persist reports atomically, preserve old reports, reuse exact reruns, and test failure/replay behavior.

## 3. Explicit approval

- [x] 3.1 Add Approval record/status with explicit user statement, scope, exact report/Definition binding, append-only history, no-overwrite, and stale detection.
- [x] 3.2 Add CLI validation, review-record, approval-record/status commands and a Skill workflow that cannot manufacture user responses.
- [x] 3.3 Add tests for AI cannot create Approval, blocked/stale report denial, explicit statement-bound approval, idempotent replay, post-approval invalidation, Critical Finding/pending Decision blocking, upstream immutability, and write failure preservation.

## 4. Integration and verification

- [x] 4.1 Update workspace scaffolding, docs, CLI help, and exports while preserving old workspaces and Change 01–07 behavior.
- [x] 4.2 Run typecheck, build, all tests, strict validation, built CLI E2E and Change 01–07 regressions; record semantic evaluation separately.
