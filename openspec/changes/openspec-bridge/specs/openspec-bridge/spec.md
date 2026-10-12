# Spec Delta

## Purpose

Export a currently approved Product Definition as a traceable, strict-validatable OpenSpec change draft without starting implementation.

## ADDED Requirements

### Requirement: Export requires current Change 08 approval and fresh validation
The bridge SHALL recompute current Change 08 readiness before export and require a current Approval bound to the exact Definition, ValidationReport, and input fingerprint. It SHALL block missing, stale, blocked, or invalid approval, unresolved in-scope Critical Finding, pending Decision/Application, or missing semantic review.

#### Scenario: Draft or unapproved Definition
- **WHEN** a Definition exists but has no current user Approval bound to a ready ValidationReport
- **THEN** export is blocked before any OpenSpec output is written
- **AND** the CLI reports the blocking artifact and does not change product artifacts

#### Scenario: Approval invalidated after editing
- **WHEN** any source, Definition, Decision, Application, Policy, Graph/Impact, Finding, Assumption, review, or validation rule changes after approval
- **THEN** export reports approval stale and writes no change files

### Requirement: Export preserves product requirements and provenance
The generated proposal and capability spec SHALL preserve requirements, scenarios, Acceptance Criteria, Policy conditions/actions/outcomes/exceptions, explicit exclusions, unresolved risks, and references to source Definition items, Decisions, Prompts, Nodes, and relevant Policy/Journey artifacts. It SHALL distinguish product evidence from generated OpenSpec text and SHALL NOT invent technical design.

#### Scenario: Requirement and Acceptance Criteria conversion
- **WHEN** an approved functional or nonfunctional requirement has acceptance criteria
- **THEN** the exported capability contains the requirement and testable scenario/criteria without changing their meaning
- **AND** each requirement provides stable source IDs and typed hash references

#### Scenario: Policy exception and exclusion conversion
- **WHEN** Definition contains a Policy with exceptions or an explicit scope exclusion with residual risk
- **THEN** export includes the condition text, supported structure, exceptions, exclusion scope, impact, and residual risk
- **AND** it does not infer priority or call excluded risk resolved

#### Scenario: Ambiguous content
- **WHEN** product content is semantically inconclusive or outside the supported conversion
- **THEN** export preserves source wording and uncertainty as explicit notes or blocks if faithful representation is impossible
- **AND** it never silently drops or resolves the content

### Requirement: Export creates only a new initial change and is non-destructive
The bridge SHALL create only `proposal.md`, `specs/<capability>/spec.md`, and a ProductKit export manifest. It SHALL reject unsafe identifiers, symlink paths, existing Change IDs, and existing manifest IDs. It SHALL validate staged output with pinned OpenSpec strict validation before publication and SHALL NOT overwrite existing OpenSpec files or generate `design.md`, `tasks.md`, or invoke apply.

#### Scenario: Duplicate Change ID
- **WHEN** the requested change directory already exists
- **THEN** export fails without modifying any existing byte

#### Scenario: Strict validation failure or file-write failure
- **WHEN** staged OpenSpec strict validation or any staged write/flush/publish fails
- **THEN** no partial change is treated as exported and pre-existing files remain byte-identical
- **AND** any newly published transaction-owned output is removed only after its hashes are verified unchanged

#### Scenario: Identical request replay
- **WHEN** the same export request is repeated
- **THEN** it reports the existing export and does not overwrite or create a second artifact

### Requirement: Export is a handoff, not implementation approval
Exported OpenSpec content SHALL be labeled as a product requirement draft, retain warnings and traceability, and SHALL NOT claim implementation plan completeness. The bridge SHALL not invoke Apply, Archive, or any implementation workflow.

#### Scenario: Generated handoff
- **WHEN** a strict-validatable change is published
- **THEN** no `design.md` or `tasks.md` exists and output states that implementation has not started
- **AND** strict validation is reported separately from semantic correctness

## Structural and semantic verification

Approval/hash freshness, path safety, file generation, provenance refs, duplicate detection, and OpenSpec strict validation are deterministic. Whether converted language preserves product intent is a separate semantic review and cannot be proven by OpenSpec validation.
