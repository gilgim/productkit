# Tasks

## 1. Contracts and Traceability

- [x] 1.1 Add versioned Definition, Journey, Policy, Application, application journal, and verification schemas; verify strict parsing, deterministic IDs/hashes, and append-only history with schema tests.
- [x] 1.2 Add typed reference extensions for Policy, Definition, and Application to Finding evidence/related refs without changing Finding states; verify existing Change 05–06 Finding fixtures remain valid.
- [x] 1.3 Implement current-hash and lineage resolution across Prompt → Clarification → NodeGroup → Node → Finding/Proposal/Decision → Definition/Policy/Application; verify valid partial paths and reject missing refs, stale hashes, and provenance cycles.
- [x] 1.4 Document provenance classes (`source`, `ai_inference`, `user_decision`) and verify no generated Definition item can claim user authority without a current Decision reference.

## 2. Decision Application and Recovery

- [x] 2.1 Implement application planning/preview that binds current Decision hash, target before hashes, planned after hashes, scope, evidence, Findings, risks, and current before-impact reports; verify stale targets block before writes.
- [x] 2.2 Implement journaled multi-target apply with same-directory atomic publish, compare-and-swap, per-target progress, retained backups, and post-write reference checks; verify success requires every expected after hash.
- [x] 2.3 Implement interrupted-apply inspection and guarded resume/rollback; verify before/after/mixed/externally-edited target cases and preserve unrelated bytes.
- [x] 2.4 Implement idempotent application replay and failure-safe persistence; verify same plan reuses the same record and target-access failure preserves existing data, interrupted multi-artifact application resumes safely, and replay returns the same Application.
- [x] 2.5 Implement separate application verification records and stale detection; verify applied does not imply verified, resolved, or approved.

## 3. Definition and Policy Artifacts

- [x] 3.1 Implement Definition projection from current Nodes and applicable Decisions with scope, stakeholders, requirements, Journeys, policies, acceptance criteria, exclusions, open Findings/Assumptions, and typed provenance; verify out-of-scope behavior is emitted only as a review candidate.
- [x] 3.2 Implement Policy schema and bounded boolean condition AST; verify AND/OR/NOT grouping, typed quantities/time scopes, exceptions, and unsupported comparisons are preserved or reported inconclusive.
- [x] 3.3 Implement policy consistency classification for contradiction, exception, replacement, independent constraints, and inconclusive cases; verify overlap alone and `exception_of` alone never resolve a conflict and AI cannot set priority.
- [x] 3.4 Bind current before-ImpactReports in the plan and recompute/embed after-ImpactReports after successful apply; verify confirmed, potential, review-only, blocked, and unreviewed inputs remain visible.
- [x] 3.5 Add/extend `skills/define/SKILL.md` for evidence-led Definition and Policy drafting; verify the skill asks for unresolved decisions and reports unreviewed scope instead of claiming completeness.

## 4. CLI, Compatibility, and Verification

- [x] 4.1 Add Change 07 CLI commands for Definition/Policy validation, application preview/apply/recover/verify, and status; verify CLI performs no LLM calls and does not alter Decision/Finding state.
- [x] 4.2 Add compatibility and regression tests for existing workspaces, v0/v1 config reading, Change 01–06 commands, immutable artifacts, and no-overwrite behavior; verify no implicit config migration occurs.
- [x] 4.3 Update `docs/artifact-contracts.md`, `docs/architecture.md`, and `docs/roadmap.md` to describe implemented contracts and correct the Finding-resolution ownership statement; verify documentation matches schemas and command behavior.
- [x] 4.4 Run `npm run typecheck`, `npm run build`, `npm test`, `npx openspec validate product-definition-and-policy --strict`, and built CLI E2E; record structural results separately from AI semantic evaluation.
