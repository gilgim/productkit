# Proposal & Decision

Use this skill after Challenge has produced Findings. The CLI validates local structure and hashes; it does not call an LLM, verify semantic correctness, or authenticate the speaker of a recorded statement.

## Review sequence

1. Read current Findings, their review state, evidence and linked Challenge/Graph inputs. Work only from current hashes; report stale inputs instead of reusing them.
2. Present alternatives with evidence, expected impacts, side effects, benefits, costs, risks, assumptions and residual issues. For every Proposal option, state its approach for every targeted Finding.
3. Keep an AI recommendation separate from the user's choice. Save Proposal input with `productkit propose add --input <yaml>`; this records alternatives only.
4. Ask the user to choose an option or state a different decision. Preserve the user's exact words in `--user-statement`; if no answer is given, stop without creating a Decision.
5. Record choice details with `productkit decide record --input <yaml> --user-statement <exact words> --rationale <reason> --scope <scope>`. For a direct decision, encode `selection.kind: direct_user_decision` and the exact chosen text in the input.
6. Report the Decision as `pending_application`. Change 06 does not apply it, resolve or defer a Finding, or assert semantic success. Change 07 owns application; later review owns outcome verification.

For a Critical Finding scope exclusion, require an explicit user statement, excluded scope, impact, rationale and residual risk. The record remains a scope exclusion, not a resolution, and the Finding stays unresolved.

Never invent a user statement, select an option on the user's behalf, or claim that a hash proves who spoke. If the user has not replied, leave the Decision uncreated and report the pending question.
