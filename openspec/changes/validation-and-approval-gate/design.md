# Design: Validation & Approval Gate

## Context and constraints

Change 07 keeps Product Definition in `draft`, does not change Finding resolution, and records Application separately from verification. Change 05's ChallengeRun measures review coverage, not correctness. Change 06 Decision remains immutable and pending application. Change 08 therefore consumes these artifacts; it must not rewrite upstream claims or interpret structure PASS as semantic PASS.

## Records

`ValidationReport` is append-only under `product/validations/`. It binds the Definition hash, all current source/Node/Graph/Challenge/Finding/Proposal/Decision/Application/Policy/Journey/Assumption and ImpactReport hashes that exist in scope, validation rules version, and completeness. It contains individually identified checks with `pass`, `warn`, `fail`, `stale`, or `not_assessed`, plus AI semantic review coverage and explicit unreviewed scope. A report cannot claim semantic PASS from machine checks. Reports are re-evaluated on demand; old reports remain immutable and can be shown as stale.

`Approval` is append-only under `product/approvals/` and binds the exact Definition hash, current ValidationReport ID/hash/fingerprint, a nonempty user confirmation statement, scope and timestamp. CLI validates record shape and binding only; it cannot authenticate the speaker or prove the statement's truth. Superseding approval does not erase history. The current approval is valid only while all bound inputs and rules are unchanged and readiness remains non-blocked.

## Readiness rules

Machine checks cover schema and typed references, Prompt lineage, current hashes, Challenge coverage, Proposal/Decision freshness, pending Decision applications, Application status and verification freshness, Journey state-graph integrity and terminal reachability, required acceptance criteria, Policy structure and bounded comparisons, ImpactReport completeness, Assumptions, and Finding states. Missing required product content and unresolved in-scope Critical Findings block. A Critical Finding excluded from scope is only eligible for a warning if the current scope-exclusion Decision is applied into Definition with impact and residual risk preserved; it remains visible as an active risk and is not called resolved. Noncritical unverified assumptions and incomplete-but-explicit review coverage are warnings where the Constitution permits.

AI review is a separately recorded assessment bound to the same snapshot, with assessor class, reviewed areas, Finding references, evidence, uncertainty, and unreviewed scope. An AI assessment may report findings or inconclusive; it cannot set machine checks, resolve Findings, or approve. No review record means semantic review is `not_assessed` and blocks final approval.

## Freshness

Canonical input fingerprint includes current relevant artifact hashes and validation rule version, excluding report/approval records themselves to avoid self-reference. Validation recomputes rather than trusting stored statuses. Approval validity checks its report and fingerprint against the recomputed current state. Any relevant change yields stale; old records are retained.

## Persistence and CLI

Writes use create-only atomic files and deterministic IDs for exact replay. Existing paths with different content fail closed. `productkit validate [--json]` runs all checks and writes a report even when blocked, returning exit 1 for blockers. `productkit validate review --input <yaml>` records an explicit AI/user semantic assessment as evidence (it does not itself pass the Gate). `productkit approve record --validation <id> --user-statement <text> --scope <text>` requires fresh readiness with no blocking checks and current semantic review. `productkit approve status` reports valid/stale/missing approval. No command mutates upstream Finding/Decision/Application artifacts.

## Risks

- Meaning cannot be established by Zod/hash checks; report labels must separate structure from semantic review.
- A local CLI cannot verify user identity; approval is a tamper-evident local record, not authentication.
- Input catalogs can omit a new artifact type; rules version and closed artifact inventory must be explicit, and unknown files are reported as unreviewed.
- This Change does not start Agent review automatically; the installed Agent Skill performs semantic review and submits its record.
