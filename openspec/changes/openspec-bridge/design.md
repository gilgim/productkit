# Design: OpenSpec Bridge

## Inputs and preconditions

Export reads the current Product Definition, all referenced Decision/Prompt/Node/Policy/Journey/Challenge/Finding/Assumption/Graph/Impact artifacts, the latest ValidationReport, semantic review and current Approval. It recomputes Change 08 readiness; it never trusts an old PASS. Definition ID/hash, Approval ID/hash, ValidationReport hash, input fingerprint, OpenSpec schema version, and exporter version form the export manifest.

## Output shape

For `productkit export openspec --change <change-id> [--capability <capability-id>]`, create only:

```text
openspec/changes/<change-id>/
  proposal.md
  specs/<capability-id>/spec.md
```

The proposal states the problem, outcome, scope, constraints, unresolved risks/warnings, and source trace references. It explicitly says the export is a draft and does not start implementation. Capability spec maps functional/nonfunctional requirements and policies into requirements and scenarios. Acceptance Criteria are preserved verbatim as testable scenarios/criteria. Policy conditions are rendered with original condition text and explicit operator/exception/priority provenance; exclusions and unresolved risk are retained. Every generated requirement includes Product Definition item IDs and current Decision, Prompt, Node/Policy references and hashes. No capabilities or technical design are inferred.

## Safe generation

Change and capability identifiers use a conservative lowercase kebab-case grammar. Existing target path, symlink, malformed workspace, missing OpenSpec installation, or duplicate export fails closed. Build output under a unique temporary directory within `openspec/changes`, validate it using the installed OpenSpec CLI with `--strict`, then publish by same-filesystem rename only if the destination is still absent. On any failure, remove only the transaction's temporary directory. A manifest under `product/exports/` is published with the change and binds hashes; if manifest publication fails, remove the newly created output only when all files still match this transaction's hashes. Concurrent edits are preserved and reported.

## Replay and staleness

An identical export request with the same change ID is rejected as an existing target; it never overwrites or duplicates content. Changed Definition or approval requires a new change ID and fresh approval. Export checks Approval freshness, validates Definition and report input hashes, and performs Change 08 validation again before staging output.

## OpenSpec dependency

The exporter must invoke the pinned OpenSpec 1.14 CLI. The CLI is a runtime dependency because production-installed ProductKit must validate the exact output before publication; absence or version mismatch blocks export. This does not call `openspec apply` or create implementation tasks.

## Risks

- Markdown conversion can distort nuanced semantics; preserve source wording, provenance, and warnings, and avoid lossy interpretation.
- Strict validation checks OpenSpec structure, not product meaning or implementation readiness.
- Directory rename is atomic only for the staged change directory on the same filesystem; the separate manifest requires guarded recovery and is never claimed as one multi-file transaction.
