# Proposal

## Why

Change 06 records immutable user Decisions as pending application, while ProductKit has no contract for applying them to product behavior or assembling a traceable Product Definition. This change adds that bridge without treating a recorded Decision, an AI assessment, or a structurally valid artifact as proof that a Finding is resolved or the product is approved.

## What Changes

- Add an append-only Decision Application record with preview, target hash preconditions, per-target outcomes, recovery state, and separate post-application verification.
- Generate a versioned Product Definition from current Nodes and applicable Decisions, retaining provenance, exclusions, open Findings, Assumptions, and unresolved scope.
- Represent policies with explicit context, actor, condition, action, outcome, exception, and user-decided priority fields.
- Detect structural policy candidates deterministically only within a bounded condition vocabulary; leave semantic conflict decisions to AI review and user Decisions.
- Reuse Graph/ImpactReport for before-and-after impact snapshots and preserve blocked, potential, review-only, and unreviewed inputs.
- Keep Finding resolution and Product Definition approval outside Change 07; report evidence for Change 08 without changing those states.

## Capabilities

### New Capabilities
- `product-definition-and-policy`: Apply Decisions safely, produce traceable Product Definitions and policies, and record policy consistency and application verification results.

### Modified Capabilities
- None. Existing Change 02–06 contracts are consumed; their main specs are not present in `openspec/specs/` to modify. Additive typed references needed for Change 07 outputs are specified within this capability.

## Impact

- Future implementation is expected to add schemas/stores/CLI and `skills/define/SKILL.md`, and write under the existing `product/journeys/`, `product/policies/`, and `product/assumptions/` directories plus a versioned Product Definition and `product/applications/` records.
- Existing Graph, ImpactReport, Finding, Proposal, Decision, Assumption, atomic file-write, and workspace contracts are reused. Change 06 Decision files remain immutable; application and verification records are separate.
- No main docs, existing artifacts, or workspace data are changed by this planning change. Change 08 remains responsible for final readiness/approval.
