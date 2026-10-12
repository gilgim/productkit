# Design

## Context

See `proposal.md` for motivation and `specs/requirement-challenge/spec.md` for observable behavior. Change 02 stores Clarification `finding_candidates`; Change 03 stores NodeGroup-specific atomicity risk candidates; Change 04 stores typed Edges, RelationCandidates, ImpactReports, and current artifact hashes. Those records remain in place and keep their owners. Change 05 introduces cross-cutting semantic Findings and a review-run record without changing those upstream contracts.

Current main `openspec/specs/` is empty. This Change therefore creates the `requirement-challenge` capability; it does not modify a nonexistent main capability. `product/findings/` and `product/reviews/` already exist. The v1 config already has the `challenge` Stage key, so no stage-schema migration is needed.

## Goals / Non-Goals

**Goals:**

- Preserve evidence-based semantic issue proposals and review coverage separately.
- Make IDs, source references, content hashes, revisions, and freshness machine-checkable.
- Keep challenge completion distinct from Finding acceptance and resolution.
- Allow a completed review to expose unresolved/Critical Findings without declaring the product ready.
- Give Change 06 stable Finding references for later alternatives and Decision records.

**Non-Goals:**

- Reimplement Change 02 clarification, Change 03 atomicity, or Change 04 graph schema, cycles, references, or impact traversal.
- Decide policy priority, choose alternatives, create Decisions, or resolve scope exclusions.
- Claim that a checklist, AI response, schema PASS, or empty Finding list proves semantic correctness.
- Add an LLM dependency, database, new Phase, or new workspace migration.

## Decisions

### D1. Separate Finding status from review-run status

Store each Finding as `product/findings/FND-<fingerprint>.yaml` and each bounded Challenge review as `product/reviews/CHL-<id>.yaml`. A review run can be `in_progress`, `complete`, `incomplete`, or `stale`; a Finding has independent `review_status` (`proposed`, `confirmed`, `rejected`) and `resolution_status` (`unresolved`, `resolved`, `deferred`, `dismissed`). New AI output is always `proposed` and `unresolved`.

`confirmed`/`rejected` mean the user explicitly acknowledges or rejects the claim that this issue exists; neither means the product policy was decided. Both require append-only confirmation bound to the current Finding hash. `resolved`, `deferred`, and `dismissed` are Change 06-owned resolution outcomes, require a Decision reference, and are not writable through Change 05 commands. A Critical Finding may only become deferred/dismissed when a Change 06 Decision explicitly records scope exclusion. This preserves the Constitution rule that a Critical issue cannot be waved away.

Alternative considered: one `status` field for proposed/open/resolved/deferred/dismissed. Rejected because it conflates whether the user agrees a problem exists with whether the product has decided what to do about it.

### D2. Use stable content fingerprints plus append-only revisions

Finding IDs are deterministic `FND-<16 hex>` fingerprints of `type`, sorted source references, normalized `issue_key`, and normalized statement. Exact-content reruns deduplicate. The CLI does not infer semantic equivalence between paraphrases; the Skill compares existing Findings and proposes linking/revising when appropriate. A same-ID/different immutable claim is a conflict, never an overwrite. A material change creates a new proposed Finding linked by `supersedes_finding_ref`; the previous record remains intact. Claim/evidence fields are immutable after creation. Status transitions and user confirmations are append-only history entries bound to content hashes, preserving prior state without rewriting the claim.

Minimal Finding fields: `schema_version`, `id`, `fingerprint`, `issue_key`, `type`, `severity`, `statement`, `related_refs`, `evidence_refs`, `counterexamples`, `ai_assessment` (`is_ai_judgment`, rationale, confidence), `questions`, `review_status`, `resolution_status`, optional `confirmation`, optional `decision_ref`, optional `supersedes_finding_ref`, `created_at`, `updated_at`, and `history[]` with event, prior/new status and hash, actor category, timestamp, and entry hash. The closed v1 type set is `missing_requirement`, `missing_exception`, `policy_conflict`, `duplicate_policy`, `flow_gap`, `logical_inconsistency`, `graph_relation_risk`, `semantic_distortion`, `unverifiable_requirement`, `impact_coverage_gap`, and `other` (which requires an explanation). All artifact refs are typed (`prompt`, `clarification`, `node_group`, `node`, `edge`, `relation_candidate`, `impact_report`, `finding`); new IDs are not substituted for unresolved refs.

Alternative considered: embed Findings inside NodeGroup or Graph. Rejected because Findings may span multiple sources and survive changes to either artifact; duplication would create competing ownership and loss risks.

### D3. Persist ChallengeRun coverage and immutable input manifest

A ChallengeRun records `id`, explicit scope, expected review areas, each area's `reviewed | not_applicable | not_reviewed` result, rationale/evidence, in-scope artifact IDs and content hashes, Finding IDs, out-of-scope/unavailable artifacts and reasons, skill/rules version, timestamps, checkpoint/history, and a `review_hash`.

The eight required review areas are: missing requirements/exceptions; policy conflicts/duplicates; normal/failure/boundary flow gaps; condition/operator contradictions; Graph relation risks; Prompt-to-Node meaning distortion; unverifiable requirements; and missing impact candidates. A not-applicable result requires rationale. A completed run requires every area reviewed or justified not-applicable, every in-scope artifact accounted for, and no unexplained missing input. An empty Finding list is valid only with this complete run record.

Alternative considered: mark challenge done when the Agent says “no issues.” Rejected because it has no auditable scope or review coverage.

### D4. Compute freshness from semantic inputs, not run timestamps

The CLI recomputes input fingerprints from exact in-scope Prompt, Clarification, NodeGroup/Node, Graph, Candidate, ImpactReport, prior Finding, and rule-version content. Timestamps and report formatting are excluded. Changed or missing inputs make the old run stale; stale runs remain readable but cannot satisfy current review coverage. Scope expansion also requires a new/reopened run. Challenge does not mutate upstream artifacts.

### D5. Keep deterministic validation narrow

The CLI validates schemas, typed reference resolution, hash integrity, allowed state transitions, duplicate IDs, run coverage, and freshness. Existing Change 02~04 validators remain the authority for their structural contracts; Challenge consumes their current outputs and references them as evidence rather than copying their gate logic. The AI/Skill proposes semantic Findings and counterexamples. Neither CLI nor Skill can prove that the semantic search was exhaustive or that a recorded user statement is authentic.

### D6. File-based checkpoint and safe writes

Use one YAML file per Finding and one per ChallengeRun in existing directories. Write through the repository's atomic temp/fsync/publish helper and protect concurrent updates with the same local exclusive-lock/CAS pattern used by Graph storage. Save checkpoints after each review area. Resume only when the recorded input fingerprint and scope match; otherwise mark the previous run stale and begin a new run. Repeating an unchanged submission is idempotent. No index/database is introduced; lookup scans the small existing artifact directories.

### D7. Limit CLI surface and defer decisions

`productkit challenge` reports the current scope and Skill path; it does not invoke an LLM. `productkit challenge validate [--review <id>]` validates stored Finding/ChallengeRun structure and freshness. `productkit challenge finding add --input <yaml>` stores only proposed/unresolved AI candidates; `... finding confirm <id> --response confirmed|rejected --user-statement ... --rationale ...` appends actual user-supplied review. A Change 05 command cannot resolve/defer/dismiss a Finding. Resolution commands belong to Change 06.

The bundled Skill operates in this order: establish scope; load current Nodes/Graph/prior Findings and validation outputs; inspect normal paths; inspect exceptions/failures/boundaries; compare conflicts/duplicates/gaps; generate counterexamples; submit Findings; record review coverage, unknowns, and excluded scope. It distinguishes “counterexample proposed” from “defect demonstrated,” and shows material questions to the user without answering them.

## Risks / Trade-offs

- [Semantic false positive/negative] → Keep AI findings proposed, attach evidence/counterexamples, require human review, and separately evaluate semantic accuracy.
- [Checklist falsely suggests exhaustive review] → Record scope and per-area evidence/limitations; label completion as recorded coverage, never proof of completeness.
- [Finding paraphrase duplicates] → Stable issue keys and prior-Finding comparison reduce duplicates; semantic deduplication remains AI/user-reviewed and is not claimed as deterministic.
- [Upstream changes after review] → Content fingerprints stale the run; keep all prior files for traceability.
- [Finding hidden by rejection] → Rejected Findings remain stored with current-hash user confirmation and event history; Critical rejections are prominently reported.
- [Change 06 resolution coupling] → Reserve resolution statuses and Decision references now; prohibit Change 05 from writing them until Change 06 supplies the Decision contract.

## Migration Plan

No config migration. Reuse v1's existing `challenge` Stage key. Existing Change 02/03 embedded candidates remain unchanged and are included as review inputs. New Change 05 Findings and ChallengeRuns are additive files. Rollback means stopping use of the new CLI/Skill; it must not delete existing or newly written records.

## Open Questions

None required to implement this contract. The initial scope default should be all current modeled NodeGroups and their current Prompt/Clarification/Graph/Impact evidence; users may narrow it only by recording excluded scope and accepting an incomplete review.
