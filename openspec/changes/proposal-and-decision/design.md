# Design

## Context

See [proposal.md](proposal.md) for motivation and [spec.md](specs/proposal-decision/spec.md) for observable behavior. The repository currently has no archived main capability specs. Change 05 provides immutable Finding claims with `review_status` (`proposed | confirmed | rejected`) and `resolution_status` (`unresolved | resolved | deferred | dismissed`), a Finding claim/content hash, hash-bound user confirmation history, and file-backed Finding/ChallengeRun records. Change 05 CLI can confirm/reject a Finding but has no Proposal, Decision, or resolution-writing command. Workspace scaffolding already creates `proposals/`, `decisions/`, and `findings/`.

The Constitution forbids AI-authored Decisions, requires rationale and explicit user choice, separates semantic judgment from deterministic checks, and invalidates hash-bound reviews after input changes. Change 07 owns Product Definition/Policy application; Change 08 owns readiness and final approval. Change 06 must bridge those boundaries without claiming an unapplied decision solved a Finding.

## Goals / Non-Goals

**Goals:**

- Define immutable, auditable proposal and decision records with typed, resolvable targets and current input snapshots.
- Support many Proposals per Finding, many Findings per Proposal, user choice of a listed option, and direct user-authored decisions.
- Record a Decision as pending application while leaving policy application, semantic resolution assessment, Finding resolution, and final approval to later approved Changes.
- Preserve Critical scope exclusions and their risk rather than relabeling them as resolved.
- Keep deterministic checks in CLI and semantic alternative/resolution judgment in the Agent Skill.

**Non-Goals:**

- Generate or modify Journeys, Policy, Product Definition, or approval records (Change 07/08).
- Claim that a valid Decision is correctly implemented or semantically sufficient.
- Authenticate a user's identity or prove that a persisted confirmation sentence was actually spoken.
- Change Change 05's Finding schema or retrospectively modify its artifacts. If implementation reveals that an existing invariant must change, stop and propose the smallest explicit spec delta before coding.
- Automatically mark a Finding resolved merely because a Decision exists, was selected, or was marked applied.

## Decisions

### D1. Use immutable Proposal snapshots and append-only Proposal events

Store `product/proposals/PROP-<fingerprint>.yaml`. A Proposal contains `schema_version`, ID, one or more Finding refs with each target's immutable claim hash and confirmed review status, an input manifest, an explicit set of options, optional AI recommendation and rationale, `pending` state, timestamp, and hash-bound creation history. Each option has a stable local option ID, description, evidence refs, benefits, costs, risks, assumptions, expected impacts/side effects, proposed Node/Graph/Policy target refs, per-Finding coverage, and residual issues.

Proposal claim content is immutable. A substantive alternative change creates a new Proposal with `supersedes_proposal_ref`; the old Proposal remains readable. A recommendation is metadata authored by AI and never sets a selected option. The Proposal fingerprint includes target Finding IDs/claim hashes and normalized option content, so parallel or repeated exact submission can be idempotent while different alternatives remain separate.

Alternative considered: edit an existing Proposal in place and rewrite its history. Rejected because earlier options, AI recommendations, and the user's later choice must remain auditable against the exact snapshot that was presented.

### D2. A Decision is a user-authored immutable intent

Store `product/decisions/DEC-<fingerprint>.yaml`. The record includes `decision_type` (`content_decision | scope_exclusion`), explicit Finding refs and claim hashes, optional Proposal and option refs, selected kind (`proposal_option | direct_user_decision`), the exact selected text, actual user confirmation statement, rationale, applicability/scope, evidence refs, Node/Graph/Policy version manifest, decision time, and a hash-linked creation history. Decision ID/hash is based on its complete immutable intent. A repeated identical Decision returns the same record; a different choice for overlapping Finding/snapshot is a conflict unless the user explicitly supersedes the earlier Decision.

The Decision CLI requires the actual user statement in an explicit `--user-statement` argument alongside rationale and scope. The Agent Skill may explain options and ask questions, but it must stop if no user response was given. CLI checks required fields and hashes; it does not authenticate the speaker.

If a superseding Decision changes scope or targets, require explicit user input again and include old Decision ID. Keep superseded Decision records. A Decision may target multiple Findings only by listing every one and the associated current claim hash; it cannot change or resolve an unlisted Finding.

Alternative considered: use one mutable Decision with `active | superseded` status. The immutable-record plus explicit supersedes link is preferred so edits cannot erase the actual prior selection.

### D3. Decision stops at pending application; Finding resolution is outside this implementation

Each immutable Decision records `application_status: pending_application`. Change 06 provides no command or schema transition that claims content/policy was applied, assessed after application, or resolved. A selected alternative can target a future Change 07 Definition/Policy change, but remains pending until that Change creates the actual artifact. A scope-exclusion Decision records the accepted scope and residual risk only; it does not alter the Finding's `resolution_status`.

The Change 06 stores and CLI must preserve Change 05 Finding `review_status`, `resolution_status`, and confirmation/history bytes. Any request to set `resolved`, `deferred`, or `dismissed` through a Change 06 command is rejected. The later application, post-application semantic assessment, and resolution mechanism require a future explicitly approved change. This avoids a stale-review cycle and ensures Change 06 cannot overstate completion.

Alternative considered: ship DecisionApplication/ResolutionAssessment now but leave them pending. Rejected for this implementation because the current user-approved boundary explicitly excludes application, post-application semantic review, and Finding resolution.

### D4. Critical scope exclusion is explicit and remains visible

A Critical Finding cannot be resolved, rejected, deferred, or dismissed by an AI action. A scope-exclusion Decision requires a specific user confirmation, the exact Finding claim hash, excluded population/behavior, reason, expected impact, residual risk, affected Definition scope, and evidence. It does not change Finding state in Change 06; the Finding stays unresolved until later authorized work reflects and evaluates the exclusion. Change 08 must report the excluded risk and its approval basis. No generic `dismissed` transition is available for Critical Findings.

Alternative considered: call an exclusion “resolved.” Rejected because the risk remains true outside the accepted scope and must not disappear from readiness reporting.

### D5. Detect conflicts and stale state deterministically

Use typed references and current content hashes for Proposal→Finding and Decision→Proposal/option/Finding. A Proposal whose Finding claim hash or input snapshot changed is stale and cannot be selected. A Decision's currentness is derived by recomputing its referenced inputs; do not rewrite the Decision to stale. Conflicting Decisions with intersecting Finding targets require explicit supersession.

When a referenced Node/Graph/Policy input changes after selection, preserve the Decision and report its stale input refs. No reverse traversal of all Graph edges is assumed; only the recorded typed snapshots are checked in this Change. Change 07 may consume Change 04 impact candidates.

### D6. Persist locally with atomic create and compare-and-swap updates

Use one YAML record per Proposal and Decision under existing workspace directories; no DB or schema migration. Creation uses deterministic content IDs and atomic no-overwrite publish. Mutable aggregate indexes are avoided; stores scan records. Existing records remain immutable. A failed write leaves existing bytes intact. Exact reruns reuse the same record; changed inputs require a new revision/Decision and explicit supersedes link where applicable.

Rollback is stopping use of the new CLI/Skill. Do not delete Proposal, Decision, or history files during rollback. Existing Finding files remain readable; the Change 05 schema version and embedded status fields stay unchanged.

### D7. Keep CLI structural and Skill semantic

CLI owns schema, typed reference resolution, unique ID/fingerprint checks, hash validation, explicit user-input fields, pending-application state, stale checks, conflict detection, and atomic no-overwrite persistence. CLI does not judge whether an alternative is good, whether two policies truly conflict, or whether a Critical exclusion is acceptable. Change 06 has no application or Finding-resolution write path.

The `skills/propose/SKILL.md` workflow reads current Finding/Challenge/Graph/Impact evidence, creates option candidates with trade-offs and residual issues, presents them to the user, and captures the user's exact choice. It stops without a Decision if there is no response. It does not apply a decision, mark a Finding resolved, or describe scope exclusion as eliminating risk. Change 07 consumes pending Decisions; Change 08 evaluates final readiness.

## Risks / Trade-offs

- [User confirmation cannot be authenticated from a local YAML file] → Preserve exact statement, actor claim, time, hash, and CLI limitation; require live explicit input in the interaction flow.
- [A recorded choice is mistaken for an applied fix] → Keep every Change 06 Decision `pending_application`; Change 06 provides no Finding-resolution transition.
- [Many-to-many Proposal/Decision mapping becomes ambiguous] → Require per-Finding claim hashes and per-option Finding coverage; resolution is evaluated individually.
- [Change 07 implementation is delayed] → Keep decision recorded and application pending; do not resolve.
- [Critical scope exclusion hides residual risk] → Keep deferred Finding visible with exclusion scope and risk in Change 08 readiness.
- [Hash churn from unrelated content] → Hash only normalized referenced claim/artifact content and explicit rule versions; do not rely on timestamps or whole-workspace formatting.
- [Multiple writers race] → Atomic no-overwrite creation plus local locking/CAS; surface conflict for retry instead of last-write-wins.

## Migration Plan

No migration is planned. Reuse `product/proposals/` and `product/decisions/`; new workspaces already create them. Existing Finding schema v1 remains unchanged. The implementation must read existing Finding/ChallengeRun files without rewrite, and no Finding's resolution state is backfilled from a legacy Proposal or Decision. If an existing Finding has a `decision_ref` but no resolvable Change 06 Decision artifact, preserve it and report a blocking unresolved reference rather than infer a decision.

Rollback disables the commands and Skill; it does not remove any written records. A subsequent compatible implementation can resume from immutable files.

## Open Questions

Change 07 owns actual Product Definition/Policy application. Later authorized work owns post-application semantic review and Finding resolution; Change 08 owns overall readiness and approval. These later contracts are intentionally not implemented here.
