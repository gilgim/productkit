# Proposal

## Why

Challenge preserves confirmed or proposed Findings, but users currently have no structured way to compare ways to address them and record their own decisions. Change 06 provides traceable alternatives and user-authored decisions while keeping a recorded decision distinct from policy application and verified resolution.

## What Changes

- Add a Proposal artifact that can cover one or more Findings, hold multiple alternatives with evidence, impact, side effects, target candidates, and residual issues, and preserve AI recommendation separately from user choice.
- Add an append-only Decision artifact for an explicit user selection, a user-authored option outside the Proposal, or a scope-exclusion decision, bound to the current Finding/Proposal and referenced Node/Graph/Policy snapshots.
- Record Decisions as `pending_application` only. Application, post-application semantic verification, Finding resolution, and final approval remain outside Change 06; a Decision alone never resolves a Finding.
- Add deterministic validation for typed references, hash integrity, allowed state transitions, stale inputs, duplicates/conflicts, and safe persistence; AI remains responsible for semantic assessment.
- Protect Critical Findings from AI resolution, unsupported deferral/dismissal, unrelated Decisions, or scope exclusion without explicit user statement and recorded impact.
- Add a Proposal/Decision Agent Skill and CLI workflows that collect user input but never manufacture it.

## Capabilities

### New Capabilities

- `proposal-decision`: Alternative proposals, explicit user Decisions, current hash/reference checks, supersession, and pending-application handoff.

### Modified Capabilities

- None. `openspec/specs/` currently has no archived main capabilities. Change 06 consumes the existing Change 05 Finding contract without changing that capability's requirements.

## Impact

Expected additions include Proposal/Decision schemas, file-backed stores and validation, `productkit propose` / `productkit decide` CLI commands, a `skills/propose/SKILL.md`, tests, and updated artifact/architecture/roadmap documentation. Existing `product/proposals/`, `product/decisions/`, and `product/findings/` directories are reused. No existing Finding is rewritten, no user decision is synthesized, and no Product Definition/Policy generation or final approval is introduced; those remain Change 07 and Change 08 responsibilities.
