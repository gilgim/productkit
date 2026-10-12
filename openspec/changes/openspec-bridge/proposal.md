# Change: OpenSpec Bridge

## Why

ProductKit's approved Product Definition is the product-level source of truth, but developers need a traceable OpenSpec change draft. Manually rewriting requirements risks losing acceptance criteria, exceptions, exclusions, or the decisions and Prompts that justify them.

## What Changes

- Add a deterministic export command that requires a current, valid Change 08 Approval and recomputes readiness immediately before writing.
- Generate only a new OpenSpec `proposal.md` and capability `spec.md`, preserving requirement text, scenarios, acceptance criteria, policies, exceptions, scope exclusions, and typed provenance references.
- Reject an existing Change ID, capability collision, stale approval, unsupported/incomplete input, or failed OpenSpec strict validation without altering existing files.
- Record an export manifest binding source Definition, Approval, ValidationReport, input fingerprint, and generated file hashes.

## Out of Scope

- Generating implementation design/tasks, applying or archiving OpenSpec changes, or starting implementation.
- Updating existing OpenSpec capabilities or calculating MODIFIED/REMOVED deltas.
- Inventing implementation architecture or changing Product Definition.

## Expected Outcome

Developers receive a new strict-validatable OpenSpec proposal and spec whose requirements can be traced back to the exact approved product snapshot.
