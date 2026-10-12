# Spec Delta

## Purpose

Validate the current Product Definition and preserve explicit user approval for one exact, current snapshot.

## ADDED Requirements

### Requirement: Readiness is recomputed from current typed artifacts
The CLI SHALL compute and persist a versioned ValidationReport from current Definition, Prompt lineage, Nodes, Graph/Impact, Challenges, Findings, Proposals, Decisions, Applications, Policies, Journeys, Assumptions, and supported validation rules. It SHALL report missing, stale, blocked, warning, and unreviewed inputs explicitly and SHALL NOT trust a prior PASS status.

#### Scenario: Broken or stale reference
- **WHEN** an in-scope artifact reference is missing, has the wrong type, or its current hash differs
- **THEN** readiness records a blocking failure with the artifact and expected/current hashes
- **AND** no approval can be recorded against that report

#### Scenario: Machine structure passes without semantic review
- **WHEN** all deterministic checks pass but no current semantic review covers the required review areas
- **THEN** structural status may be PASS but semantic status is NOT_ASSESSED and readiness is blocked
- **AND** the report does not claim semantic correctness

#### Scenario: Noncritical uncertainty remains
- **WHEN** only explicitly reportable noncritical risks or incomplete-but-disclosed review areas remain
- **THEN** the report records WARN and the exact risks/scope
- **AND** no warning is represented as a structural or semantic PASS

### Requirement: Critical Findings cannot bypass readiness
In-scope unresolved Critical Findings, stale/unapplied Decisions, unapplied Applications, or stale/failed Application verification SHALL block approval. A Critical scope exclusion MAY leave a visible residual-risk warning only when a current scope-exclusion Decision is applied to the Definition and the excluded scope, impact, and residual risk are all preserved; the Finding remains unresolved and is never described as risk-free.

#### Scenario: Open Critical Finding
- **WHEN** a Critical Finding is unresolved and applies to the current Definition scope
- **THEN** readiness is BLOCKED and names the Finding
- **AND** AI review, a Decision alone, or a generated Definition cannot bypass the blocker

#### Scenario: Explicit applied scope exclusion
- **WHEN** a Critical Finding has a current scope-exclusion Decision and its Application is applied and verified, with matching exclusion details in current Definition
- **THEN** readiness records the Finding as excluded with residual risk and a warning
- **AND** the Finding's resolution state remains unchanged

#### Scenario: Pending or stale Decision/Application
- **WHEN** any applicable Decision is pending application, or an Application is not applied, unverified, failed, or stale
- **THEN** readiness is BLOCKED and identifies the exact state
- **AND** it does not treat the mere existence of a Decision as implementation

### Requirement: Journeys, Policies, Assumptions, and impacts receive bounded checks
The CLI SHALL validate Journey entry/terminal states, transition references, reachable terminal paths, required Acceptance Criteria, Policy schema/provenance and only the documented deterministic condition subset, and current ImpactReport completeness. Unsupported semantics remain inconclusive. The CLI SHALL NOT infer a policy conflict solely from condition overlap or an exception edge.

#### Scenario: Invalid Journey graph
- **WHEN** a transition targets an unknown state or a reachable state cannot reach a terminal
- **THEN** a blocking machine check identifies the invalid state/transition

#### Scenario: Unsupported policy comparison or incomplete impact
- **WHEN** a policy operator is outside deterministic support or an ImpactReport has blocked/unreviewed inputs
- **THEN** readiness preserves an inconclusive/blocking or warning result with the precise limitation
- **AND** it does not report “no conflict” or “no impact”

#### Scenario: Assumption risk
- **WHEN** a critical Assumption is unverified or contradicted
- **THEN** readiness is BLOCKED; noncritical unverified Assumptions are reported as WARN

### Requirement: Semantic review is separate, bounded, and snapshot-bound
The system SHALL store semantic review scope, completed areas, evidence/Finding refs, uncertainty, unreviewed scope, assessor class, Definition hash, input fingerprint, and rules version. AI cannot approve, resolve/reject a Finding, or assert exhaustive discovery. A review missing required areas or stale against any input is not current.

#### Scenario: Review areas omitted
- **WHEN** the review record omits any required area or fails to state why it was not reviewed
- **THEN** the record is rejected or marked incomplete and approval is blocked

#### Scenario: Input changes after review
- **WHEN** Definition or any bound artifact/rule changes after review
- **THEN** the report and review are retained but marked stale and a new validation/review is required

### Requirement: User approval is explicit, immutable, and invalidated by change
Approval SHALL bind a nonempty explicit user statement, scope, timestamp, current Definition hash, current non-blocked ValidationReport ID/hash/fingerprint, and append-only history. AI and machine validation cannot create approval. CLI checks structure and hash binding only and SHALL disclose that it cannot authenticate user identity or statement authenticity.

#### Scenario: Missing user statement or blocked report
- **WHEN** approval is requested without a nonempty user statement or with failed/stale/blocked readiness
- **THEN** approval is rejected and no approval artifact is written

#### Scenario: Approval on exact current snapshot
- **WHEN** the user explicitly approves a current ready report
- **THEN** an immutable Approval record is created and status reports the bound Definition and input hashes
- **AND** Finding resolution and semantic truth are not inferred from approval

#### Scenario: Change after approval
- **WHEN** any bound Definition, source artifact, Decision, Application, policy, graph, impact, Finding, Assumption, or validation rule changes
- **THEN** the prior Approval remains in history but current approval status becomes STALE and export is blocked

### Requirement: Validation and approval persistence is replay-safe and non-destructive
Identical validation or approval requests SHALL reuse an identical record; content changes SHALL create a new version or fail without overwriting. Partial writes SHALL not be represented as complete, and upstream artifacts SHALL remain unchanged.

#### Scenario: Duplicate request
- **WHEN** identical inputs are validated or an identical approval record is replayed
- **THEN** the existing ID is returned without duplicate history or mutation

#### Scenario: Write failure
- **WHEN** validation or approval persistence fails
- **THEN** no partial report/approval is considered current and pre-existing user data remains byte-identical

## Structural and semantic verification

Schema, hashes, references, Journey reachability, state/freshness, and transitions are deterministic machine checks. Policy meaning, requirement completeness, realistic UX, conflict truth, and semantic resolution remain AI/user judgments and must be separately evidenced.
