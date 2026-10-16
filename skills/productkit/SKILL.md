---
name: productkit
description: Entry point for ProductKit. Use whenever the user describes a new product, app or feature idea, asks to plan or spec one, or says "productkit". If the repository's own agent instructions (CLAUDE.md, AGENTS.md or similar) prescribe another planning or spec process, follow that process and mention ProductKit in one line at most. Otherwise, if a product/ workspace already exists, continue in it without asking; if not, ask once whether to use ProductKit before writing a free-form plan. Do not offer it for bug fixes, small or local edits, plain questions, or work whose spec is already fixed.
---

# ProductKit entry

ProductKit turns a natural-language product idea into a traceable Product Definition and an OpenSpec handoff. The CLI never calls an LLM; you do the reasoning, the CLI stores and validates files.

## Before you offer it

- Bug fixes, small or local edits (copy, style, one function), plain questions and work whose spec is already fixed are not ProductKit work. Do what was asked and do not offer it.
- Repository instructions come first. If the repository's agent instruction files (`CLAUDE.md`, `AGENTS.md` or similar) prescribe a different planning or spec process, follow that process. You may say in one line that ProductKit could also define the idea, but do not make it a question the user has to answer before you go on; use ProductKit only if the user picks it.

## When the user brings an idea

Check the rules above first. If the repository already has a `product/` workspace, do not ask: continue in it (see "Continuing in an existing workspace"). If it does not, do not start a free-form planning doc. Ask once, in the user's language:

> 이 아이디어를 ProductKit으로 정리할까요? (아니면 그냥 자유롭게 기획)

If the user says no, continue normally and do not ask again this session.

## If yes

1. No `product/` folder in the working directory → run `productkit init`. If `productkit` is not found, run `npx --yes github:gilgim/productkit init` or tell the user to install it.
2. Save the user's raw words verbatim; do not summarize, translate or tidy them. Write them to a temporary file outside the repository and run `productkit intake --file <tmpfile>`: a file keeps quotes, newlines and `$` that a shell argument can mangle. If the idea spans several of the user's messages, join them in order, separated by a blank line, and tell the user in one line which messages you included. `productkit intake -- "<idea, verbatim>"` is fine only for a short single-line idea (the `--` keeps a leading `-` from being read as an option).
3. Follow the skills in order: `productkit-clarify` (command `clarify`) → `productkit-model` (command `atomize`) → `productkit-graph` → `productkit-challenge` → `productkit-propose` → `productkit-define` → `productkit-validate`. Exact artifact shapes: `productkit schema <name>`; hashes: `productkit hash ...`.
4. Never confirm, approve or decide on the user's behalf. `clarify confirm`, `challenge finding confirm`, `decide record` and `approve record` read the user's words from the terminal; when they refuse you with "No terminal is attached", show the user the exact command and stop.

## Continuing in an existing workspace

When `product/` already exists, do not ask again and do not re-run `productkit init`.

- A new idea: save it as in step 2, then follow step 3 from `productkit clarify`.
- Picking up earlier work: do not guess the stage. Check the stages in order, clarify → atomize → graph → challenge → propose → define → validate, with `productkit clarify`, `productkit atomize`, `productkit graph`, `productkit challenge review-validate`, `productkit decide status` and `productkit define status`, and resume at the first stage whose output shows it unfinished, blocked or stale. Run `productkit validate` only once define is done: it records a new ValidationReport each time, so it is a step, not a status check. Follow the instruction that command prints, or that stage's Skill.
