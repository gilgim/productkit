# Change: Validation & Approval Gate

## Why

Change 07 produces a draft Product Definition, but there is no deterministic, current-input gate that checks whether its references, Decisions, Applications, Findings, Journeys, Policies, assumptions, impact reports, and semantic review are ready. A stale or incomplete draft must never be described as approved, and approval must belong to a specific immutable snapshot.

## What Changes

- Add versioned ValidationReport records with structural results, warnings, blockers, semantic-review coverage, input fingerprint, rules version, and stale status.
- Add explicit user Approval records bound to the current Definition and ValidationReport hashes; never create approval through AI or a successful CLI check.
- Recompute readiness from current artifacts, preserving unresolved Critical risks and blocking unsupported or stale inputs.
- Invalidate prior reports and approvals when any relevant input, definition, or rules version changes.
- Keep structural validation, AI semantic assessment, Finding resolution evidence, and final user approval as separate facts.

## Out of Scope

- Changing Decision or Application content, applying decisions, or exporting OpenSpec.
- AI-generated final approval or automatic claims of semantic correctness.
- Modifying Finding resolution states without the existing Decision/Application evidence contract.

## Expected Outcome

`productkit validate` produces a current readiness report. Only a current non-blocked report can be used to record a user's explicit approval, and any subsequent relevant change makes that approval stale.
