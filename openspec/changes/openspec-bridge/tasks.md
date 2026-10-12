# Tasks

## 1. Export contract

- [x] 1.1 Add export manifest schema with source Definition, Approval, ValidationReport, input fingerprint, exporter/OpenSpec versions, and output hashes.
- [x] 1.2 Implement deterministic conversion of requirements, scenarios, policies, exceptions, exclusions, risks, and typed trace references.
- [x] 1.3 Implement current approval/readiness verification and safe identifier/path/no-symlink checks.

## 2. Safe OpenSpec generation

- [x] 2.1 Stage only proposal/spec files and manifest input under the target filesystem; reject existing Change/manifest IDs without writes.
- [x] 2.2 Run pinned OpenSpec strict validation against staged content before publish; fail closed when CLI is missing, mismatched, or returns nonzero.
- [x] 2.3 Publish change directory and manifest with guarded recovery, hash-checked cleanup, idempotency, and preservation of concurrent edits.
- [x] 2.4 Add `productkit export openspec --change <id> [--capability <id>]`; do not call Apply/Archive or create design/tasks.

## 3. Verification

- [x] 3.1 Test approved export, stale/unapproved export, trace preservation, policies/exceptions/exclusions, duplicate export, valid strict validation, no-overwrite on existing output, stale/unapproved blocking, file-write failure, replay, and external modification detection.
- [x] 3.2 Test actual strict validation of generated proposal/spec with the installed OpenSpec 1.14 package and built CLI E2E.
- [x] 3.3 Verify Change 01–08 regression, package-installed CLI behavior, and documentation; run typecheck, build, test, and strict validation.
