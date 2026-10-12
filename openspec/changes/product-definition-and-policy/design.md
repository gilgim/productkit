# Design

## Context

Change 06 stores immutable Decisions with `application_status: pending_application`; its CLI explicitly does not mutate Product Definition or Finding resolution. Change 04 already provides typed, user-confirmed Graph edges and hash-bound ImpactReports with confirmed/potential paths, review candidates, blocked inputs, and completeness. The initialized workspace has `journeys/`, `policies/`, and `assumptions/`, but no Definition/Application record schema. Change 05 Findings support typed references only through Finding and Graph/Prompt inputs, and `openspec/specs/` currently has no main capability specs.

## Goals / Non-Goals

**Goals:**
- Specify hash-preconditioned, auditable Decision application and recovery without mutating Decision originals.
- Produce a versioned Definition with explicit provenance and a policy model suitable for review.
- Keep structural checks, AI semantic assessments, user decisions, Finding resolution, and final approval distinct.

**Non-Goals:**
- Do not implement Change 08 approval, OpenSpec export, a general policy engine, arbitrary natural-language condition evaluation, automatic priority selection, or automatic conflict resolution.
- Do not rewrite Change 02–06 artifacts or introduce a new Finding state machine.

## Decisions

### D1. Immutable Decision; separate application plan, journal, and record

Treat each Decision as the immutable source of intent. A Change 07 Application Record binds the exact Decision ID/hash, current target refs and before hashes, planned after hashes/content hashes, scope, rationale, affected Findings, residual risks, pre/post ImpactReport refs, and timestamps. The plan/preview is persisted before writes and the record history is append-only. Application state (`pending`, `applying`, `partially_applied`, `applied`, `failed`, `recovery_required`) is distinct from verification state (`pending`, `verified`, `failed`, `inconclusive`, `stale`). `applied` is allowed only after all planned target bytes match their after hashes and cross-reference validation succeeds; creating a record alone is never application.

Before any write, validate every target, Decision/Finding hash, current before hash, and the full plan. A mismatch aborts before mutation. For multiple files, journal each prepared/published target and preserve exact before bytes in a transaction backup area. Publish each file with same-directory temp + atomic rename and compare-and-swap. Since multiple renames are not one filesystem transaction, interruption is recorded as partial/recovery-required. Resume only when every target is either at its before hash or expected after hash; otherwise stop for review. Rollback restores a target only if it still matches the transaction's after hash, preserving unrelated edits. Never claim automatic multi-file atomicity.

Alternatives considered: write targets directly (risks partial state without recovery); stage files then rename all (still not atomic across files); mutate Decision with applied state (violates Change 06 immutability). A journal plus guarded forward recovery is chosen.

### D2. Product Definition is a projection with explicit provenance

Store one versioned Definition manifest at `product/definition.yaml`; retain detailed Journey and Policy artifacts in the existing `product/journeys/` and `product/policies/` directories. The manifest groups goals/scope, users and stakeholders, functional and non-functional requirements, Journey/Policy/Acceptance Criteria references, explicit exclusions, open Finding/Assumption refs, unresolved items, and a provenance ledger. Every generated claim is classified as `source`, `ai_inference`, or `user_decision`; only current user Decisions may authorize a new product commitment. Node statements remain source facts; Definition items reference Nodes/Decisions/Prompt lineage with hashes instead of copying source facts as new authority. AI may reorganize or derive phrasing but may not add behavior absent from source/confirmed decisions. New behavior discovered while structuring becomes a Finding/Proposal request.

Every normative Definition item must cite a current explicit Decision and preserve a resolvable path from that Decision to its source Prompt, consistent with CONSTITUTION.md. Node and Clarification references provide supporting lineage, not a substitute for the Decision link. Unconfirmed source material remains evidence or an unresolved item and cannot be promoted into committed product behavior. The Definition is a draft/generated artifact, not an approval. Change 07 does not write the Change 08 `confirmed`/approval state. A scope-exclusion Decision must create an explicit exclusion item and preserve its residual risk and related Critical Finding.

### D3. Policy condition is a typed, bounded expression

Represent Policy with `context`, `actor`, `condition`, `action`, `outcome`, `exceptions`, `priority`, and typed provenance. `condition` uses a versioned boolean AST (`all`, `any`, `not`, and supported typed comparisons over explicitly declared scalar fields and units). Natural-language condition text is retained as source/evidence, but arbitrary prose is not executable. The first supported deterministic subset is equality/inequality and ordered numeric comparisons over compatible declared types; no implicit timezone, unit conversion, text entailment, or missing-value assumptions. Unknown operators, incompatible types/units, and unsupported ranges yield `inconclusive`, not no-conflict.

Priority must be unset or trace to a current explicit Decision. An `exception_of` edge or non-empty exception field does not itself establish subset scope or remove a conflict. `supersedes` records replacement lineage; old Policy remains available. `conflicts_with` and `duplicates` are reused as graph evidence where applicable, not as a semantic verdict.

Alternatives considered: natural-language-only Policy (cannot be structurally compared); full rules engine (out of scope and risks invented semantics); a small typed AST is selected to bound deterministic checks.

### D4. Policy consistency is triaged, not auto-resolved

Classify outputs as `structural_error`, `semantic_candidate`, `explicit_exception_candidate`, `replacement_candidate`, `independent_conditions`, or `inconclusive`. Deterministic checks can report malformed fields, incompatible types, explicit equal normalized conditions with incompatible declared outcomes, duplicate hashes, and broken refs. A condition intersection alone is insufficient to establish conflict. AI reviews scope, intent, action compatibility, exception coverage, and counterexamples; it records a proposed Finding with uncertainty. User confirmation and any priority/choice continue through Change 05/06. Exception edges never suppress a candidate automatically. Unsupported or uncertain comparisons remain visible as candidates and/or blocked inputs.

### D5. Reuse ImpactReport and bind analysis to inputs

The Application plan binds current before-ImpactReports for every changed Node seed. Because after-ImpactReports cannot exist before a write, successful application recomputes them immediately after all targets are published using the existing Graph rules and embeds the immutable report snapshots in the append-only Application record. Each snapshot binds report ID, input fingerprint, completeness, and report hash. Missing seeds are `unassessed`; incomplete reports remain incomplete and never mean zero impact. Changed Node, Graph, Edge, RelationCandidate, Policy, Finding, Decision, or relevant rules make affected application/verification results stale; retain old records and produce new analysis. A new conflict or material impact creates review candidates that can route back to Challenge/Decision; there is no silent auto-edit.

### D6. Finding resolution and approval remain separate

Change 07 may record application verification as `verified`, `failed`, `inconclusive`, or `stale`, but does not change Finding `resolution_status` or `review_status`, even for Critical Findings. A successful application does not establish that the originally reported issue is semantically solved. Change 08 consumes the current Decision, Application, verification, open Finding, Assumption, Definition, and impact evidence to make readiness/approval and any final resolution assessment under its own contract. Until then, Findings remain in their existing state; Critical risks and accepted-risk Assumptions stay visible.

The existing Finding schema lacks reference kinds for Policy, Definition, and Application. Add only these typed reference kinds for evidence/related-ref linkage; do not change its states or transition authority. This additive contract is necessary for policy-conflict candidates to be traceable.

### D7. No schema migration for config in this Change

Change 04 already migrated config to v1 with eleven Stage keys including `define`; Change 07 writes artifacts under established directories and uses `define` as a progress hint only. No additional config/schema version change is required. Supporting legacy v0 reading remains an existing compatibility contract; this Change does not run migration implicitly.

## Risks / Trade-offs

- [Crash or concurrent edit during multi-target publication] → CAS each target, journal phases, retain exact backups, detect mixed states, and require guarded recovery; never promise a cross-file transaction.
- [Rollback might overwrite an unrelated edit] → restore only when current bytes equal the transaction's recorded after hash; otherwise stop and preserve all bytes.
- [Condition subset misses semantic overlap] → report unsupported/inconclusive cases and AI review scope; deterministic PASS is structural only.
- [Definition projection drifts from upstream artifacts] → hash every input and mark generated output stale; preserve prior revisions.
- [Finding evidence refs do not currently include Policy/Definition/Application] → additive typed-ref extension with unchanged states; validate referential integrity.
- [User statement cannot be authenticated by local CLI] → validate required text and hashes only; state explicitly that identity/authenticity is not proven.

## Migration Plan

No eager workspace migration. New records use `schema_version: 1`; absent Definition/Application artifacts are treated as not created, not as empty approved state. Existing v0/v1 config remains readable and unchanged. On first application, create only new paths with no-overwrite semantics. Recovery replays a journal only after validating all recorded hashes; backups remain until an explicit successful completion/retention policy is defined. No automatic deletion is permitted.

## Open Questions

None that block the contract. Implementation may choose serialization details within the stated schemas, but may not widen supported condition operators, mutate Findings, or weaken recovery semantics without a new decision.
