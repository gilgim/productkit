---
name: productkit-propose
description: Turn challenge Findings into Proposals and record the user's explicit Decisions. Use after the challenge step.
---

# Proposal & Decision

Use this skill after Challenge has produced Findings. The CLI validates local structure and hashes; it does not call an LLM, verify semantic correctness, or authenticate the speaker of a recorded statement.

## Review sequence

1. Read current Findings, their review state, evidence and linked Challenge/Graph inputs. A Proposal may only target Findings with `review_status: confirmed`; if the user has not confirmed a Finding, hand them `productkit challenge finding confirm <id> ...` and wait. A confirmation's `user_caveat` is the user's condition on it: confirming that an issue exists is not approval of what the caveat excludes, so no option may assume it, and step 4 shows it to the user when asking for the choice. Work only from current hashes; report stale inputs instead of reusing them. Input shapes: `productkit schema proposal`, `productkit schema decision`.
2. Present alternatives with evidence, expected impacts, side effects, benefits, costs, risks, assumptions and residual issues. For every Proposal option, state its approach for every targeted Finding.
3. Keep an AI recommendation separate from the user's choice. Save Proposal input with `productkit propose add --input <yaml>`; this records alternatives only.
4. Ask the user to choose an option or state a different decision. Preserve the user's exact words in `--user-statement`; if no answer is given, stop without creating a Decision.
5. Record the choice. Write the Decision input YAML (shape: `productkit schema decision`; a proposal-option Decision needs top-level `proposal_ref` and `option_ref`, and its `input_snapshot` must include the Prompt, every Node it is about and the Proposal — take every hash from `productkit hash inputs`; `finding_refs[].claim_hash` is the `finding.claim_hash` line there), then **hand the command to the user**: `productkit decide record --input <yaml> --rationale <reason> --scope <scope>` with no `--user-statement`. The CLI reads the statement from the user's terminal; you have no terminal, so running it yourself fails with "No terminal is attached" — that is correct, stop and show the user the command. Only when `product/config.yaml` says `attestation: flag` may you pass `--user-statement <exact words>` yourself, and every validation report will then carry a warning. Never change that config line to get past the refusal. For a direct decision, encode `selection.kind: direct_user_decision` and the exact chosen text in the input. When the user answers a Proposal with a choice of their own instead of one of its options, keep the Proposal in `input_snapshot` and list every Finding the Proposal is about in `finding_refs`; validation then counts that Decision as the Proposal's answer.
6. Report the Decision as `pending_application`. Recording does not apply it. After the define step has applied and verified an Application for it, run `productkit decide resolve <DEC>`: the CLI closes the Findings the Decision is about (resolved; deferred for a scope exclusion) with the Decision id and the user's words, and the export prints the Decision verbatim under "User decisions".
7. The user's words in a Decision may be the choice itself ("취소 불가로 해줘"); only a statement that opens as a refusal ("아니", "no", "싫어" …) is refused. A Definition item, Policy field or Journey goal may then be that Decision's `user_statement` verbatim, with the Decision in `provenance.decision_refs`.

For a Critical Finding scope exclusion, require an explicit user statement, excluded scope, impact, rationale and residual risk. The record remains a scope exclusion, not a resolution, and the Finding stays unresolved.

Never invent a user statement, select an option on the user's behalf, or claim that a hash proves who spoke. If the user has not replied, leave the Decision uncreated and report the pending question.
