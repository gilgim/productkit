<div align="center">

# ProductKit

**Turn a one-line idea into a product definition where every decision has a receipt.**

A local CLI plus Agent Skills for Claude Code and Codex. The AI asks, challenges and proposes. You decide. ProductKit records who decided what, and why.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-339933.svg)](https://nodejs.org)
[![Release](https://img.shields.io/github/v/tag/gilgim/productkit?label=release)](https://github.com/gilgim/productkit/tags)

English · [한국어](README.ko.md)

</div>

---

## Why

Ask an AI to "build a running-log sharing app" and it will happily fill every blank with something plausible. Weeks later nobody can say which behavior was a decision and which was a guess.

The blanks are not only missing features. They hide in ordinary words, too. (A made-up example, just to show the idea.)

> Make this screen clean. Handle the rest well.

| What you said | What it can also mean |
|---|---|
| clean | fewer elements / tidier spacing and alignment / matching colors / refactored code |
| handle the rest | only what's on screen / related features too / ask me if stuck / don't ask, just go |
| well | fast / safe / pretty / same as before |

A person would ask, "Clean how?" An AI usually picks one plausible reading and moves on.

ProductKit does not come up with ideas for you. **It fills the gaps in the idea you already have.** More precisely, it stops the AI from filling them on its own and has you fill them: a sentence that reads more than one way gets every reading written down and stays a question until you answer it, and the reading you pick is recorded in your own words.

ProductKit puts a guard rail between the idea and the spec:

- **AI guesses never become decisions.** A `DEC-xxx` exists only when *you* said so, with a rationale.
- **Unknowns stay visible.** What the AI can't resolve becomes a `FND-xxx` finding and a question, not an invented requirement.
- **Everything traces back, both ways.** Definition → Decision → Prompt, and every sentence of the prompt lands somewhere: decomposed, raised as a question, or marked not-a-requirement with a reason you agree to. Every Node lands in the Definition, in an exclusion on record, or in an open finding. Nothing drops out silently — the gate lists what did.
- **Approval goes stale.** Change an input after approving and the approval is invalidated.
- **No LLM inside the CLI.** The CLI only handles files, schemas and validation. Reasoning happens in your own Claude Code or Codex session, so there is no extra API key and no hidden model call.

## How it works

<p align="center"><img src="docs/assets/how-it-works.svg" alt="How ProductKit works: you decide, the agent reasons, the CLI judges and records" width="100%"></p>

The CLI judges whether each stage is actually complete. The agent cannot declare itself done.

### One gap, from Finding to Decision

Follow "clean" from the table above. At `clarify`, the CLI prints your sentences in order, what was read from each, the questions left open and the places that could read differently, and you agree to that block from your terminal. "Make this screen clean." is left as a question with its readings. From there (IDs are content hashes; these are illustrative):

```text
FND-3a7c0e91d4b25f68   "Make this screen clean." sets no standard for "clean"
                       readings: fewer elements / spacing and alignment / matching colors
                       added by the agent (proposed), confirmed by you on your terminal
   ↓
PROP-8e12b4f07a9d3c65  OPT-A fewer elements · OPT-B spacing and alignment · OPT-C matching colors
                       each with benefits, costs and risks; an AI recommendation is not a choice
   ↓
DEC-c45d19e2b07f8a31   you pick OPT-A and type: "Only cut down the elements on screen."
                       with your rationale and scope; recorded as pending_application
```

The agent writes the Finding, the Proposal and the Decision input, but it cannot confirm or decide: `productkit challenge finding confirm` and `productkit decide record` read your words from the terminal that runs them, so the agent hands those commands to you. Your sentence is never rewritten. Your decided words can enter the Definition as an item of their own that cites the Decision, and once that change is applied and verified (`productkit define draft`, then `productkit define application verify`), `productkit decide resolve` closes the Finding.

## Quick start

Requires Node.js 20.19+ and Git.

```bash
npm install --global https://github.com/gilgim/productkit/archive/refs/tags/v0.1.0-beta.2.tar.gz
productkit --version        # 0.1.0-beta.2
which productkit            # confirm it is the copy you just installed
```

That is the whole setup. The first `productkit` command (the `--version` above counts) copies the agent Skills into `~/.claude/skills` and `~/.agents/skills` and keeps them current on later upgrades, so after restarting Claude Code or Codex the agent knows ProductKit in every project. Nothing is built on your machine: `dist/` ships in the repo, and there is no install script that can fail.

> The name `productkit` on the npm registry belongs to another project, so install from the GitHub tag tarball as above. Do not use `git+https://…`: npm 11 links a git dependency to a temporary clone and leaves a dead command behind.

Create a workspace inside your app and feed it an idea:

```bash
cd ~/projects/my-app
productkit init
productkit intake "I want an app where friends share their running logs"
productkit clarify
```

`clarify` doesn't write anything for you. It tells your agent what to do next:

```text
Prompt saved: PRM-001
  product/sources/PRM-001.yaml

AI action required: Clarification has not started.
  Prompt:      product/sources/PRM-001.yaml
  Instruction: skills/clarify/SKILL.md
  Write to:    product/discovery/CLR-001.yaml
  Bind prompt_ref + prompt_content_hash in the clarification and new confirmation; do not invent user agreement.
```

The gate refuses to pass until the work is real:

```text
$ productkit validate
PRODUCT READINESS BLOCKED
FAIL definition.required: Product Definition is missing.
```

Nothing else to wire. `productkit init` writes the Skills into `.claude/skills/`
and `.agents/skills/`, so Claude Code and Codex pick them up on their next
start in that directory (`--no-skills` opts out; see the
[installation guide](docs/installation.md)).

Then, in Claude Code, say `/productkit-clarify` and answer the questions. When the definition is approved:

```bash
productkit export openspec --change <change-id> --capability <capability-id>
```

`export openspec` needs the OpenSpec CLI installed in your workspace; see the [installation guide](docs/installation.md#productkit-and-openspec).

## What you get

`productkit init` creates a plain-file workspace. Markdown and YAML, diffable, reviewable in a PR.

```text
product/
├── sources/      original prompts, preserved verbatim
├── discovery/    clarifications: who, what, why, flows
├── nodes/        atomic requirements
├── graph/        typed relations and impact analysis
├── findings/     gaps, assumptions, contradictions
├── proposals/    options with benefits, costs, risks
├── decisions/    your explicit choices + rationale
├── journeys/  policies/  assumptions/
├── validations/  semantic-reviews/  approvals/
└── exports/      OpenSpec export manifests
```

## What the gate catches, and what it cannot

ProductKit was fuzzed against its own gate. Everything in the left column once reached READY and is now a blocking check with a regression test. Everything in the right column is still open, by construction: a local CLI without an LLM cannot judge meaning or identity.

| Caught by the CLI (blocks readiness) | Not caught — a person must read |
|---|---|
| A prompt that was taken in but never clarified | A sentence marked "not a requirement" with a wrong reason |
| A sentence of the prompt that is neither decomposed, raised as a question, nor set aside with a reason | A decomposition that cites the right span but says something else |
| A Node that is in neither the Definition, an exclusion Decision, nor an open Finding | A Definition item that contradicts the Node it cites |
| An exclusion item whose Decision does not exist, is stale, or says something different | An exclusion whose scope text does not actually match the Finding it closes |
| A review area marked reviewed with no evidence, with only the skill file, or with the wrong kind of artifact for that area | A reason for "not a requirement" that is wrong but plausible — the user sees the sentence and the reason side by side, and still has to read |
| A Finding marked resolved by a Decision that does not target it | A fidelity verdict of `same` that is a lie — each item/Node pair gets its own line, so the lie has to be written N times, with a reason each time |
| A Definition with no requirement or acceptance criterion | A person at the terminal who types what the agent dictated |
| A review that quietly drops an item an earlier review listed as unreviewed | A prompt that was already wrong when it was taken in |
| A `--user-statement` passed by whoever ran the command, when the workspace requires it typed on a terminal | A file an agent forges by hand with the right hashes (`attestation: tty` is a field like any other) — visible only in `git diff` |
| A sentence of the prompt parked as a "finding candidate" and never promoted to a Finding the user confirmed | |
| An agent-written Finding "holding" a Node out of the Definition; a Policy citing Nodes as cover | |
| A review area marked not-applicable when the artifact exists; a later review that drops an earlier unreviewed item | |
| A second Approval outside the supersedes chain posing as current | |
| Any input edited after approval (hash goes stale) | |

How the right column got short: the first fuzz left "distortion" and "impersonation" to a human reader. That was a process gap, not a limit. The process now forces the shape of what the human reads and who types:

- **There is no paraphrase anywhere.** A reading at `clarify` is the user's sentence verbatim; the agent only decides which sentences are requirements, which are set aside (with a reason the user sees, and never a sentence with a number, a negation or much content), which are questions. A Node at `atomize` is that sentence, whole and verbatim — the agent never cuts it (seven rounds of fuzzing showed every cutting rule can be gamed); a sentence that holds several requirements is handed back to the user to restate in separate sentences. A Definition item is its Node's text verbatim. Flipping, dropping or reordering is not something the gate detects — it is something the format cannot express. `productkit clarify` prints the block the user agrees to and `clarify confirm` records the answer from the user's terminal.
- **One verdict per pair.** The semantic review must say, for every Definition item and every Node it cites, whether the item is the same, narrower, broader or contradicts — and why. Blanket "all preserved" cannot be written.
- **Evidence must be the right kind.** `graph_impact` needs an ImpactReport, `traceability` needs a Decision and the Prompt, and so on. "Cited something" is not enough.
- **Nothing falls off the unreviewed list.** A later review of the same inputs must keep each earlier unreviewed item or resolve it with evidence.
- **Statements are typed, not passed.** With `attestation: tty` (the default), `clarify confirm`, `challenge finding confirm`, `decide record` and `approve record` read the user's words from the terminal that runs them. An agent run without a terminal is refused and hands the command to the user. This is a speed bump, not a lock: an agent that wraps the command in a pseudo-terminal (`script`, `expect`) or writes the YAML with the right hashes gets through, and only `git diff` shows it. Setting `attestation: flag` is allowed, visible, and warned on every report. A statement that reads as a refusal ("승인하지 않는다") is refused as an approval; beyond that, what the words mean is the person's.

The skills no longer carry hand-maintained field lists either: `productkit schema <artifact>` prints the exact JSON Schema the gate validates, `productkit hash ...` prints the hashes it recomputes, and a test fails the build if a skill names a command the CLI does not have.

What is left is a person who reads what is put in front of them and types what they mean. That is the floor ProductKit stands on, and it is now the only floor.

## Principles

ProductKit holds eleven rules ([CONSTITUTION.md](CONSTITUTION.md)). The ones that matter most:

1. AI inference is never recorded as a user decision.
2. Unclear points become findings, not guesses.
3. Every decision carries a rationale.
4. Every definition item traces back to the original prompt.
5. Every section of the original prompt is either included, explicitly excluded by a decision, or left as an open finding. Nothing silently drops out.
6. Alternatives show benefits, costs and risks together, not just upsides.
7. An unresolved Critical finding blocks the definition.
8. Product definition and implementation spec stay separate. No invented schemas or APIs.

## Honest limits

- This is a **v0 beta**. The structure (files, schemas, gates, hashes) is covered by 316 automated tests, including a regression suite built from adversarial attacks that once reached READY.
- Passing validation proves **structure**, not that the product is right. Semantic quality depends on the agent and on you.
- The coverage gates catch **omission**, not **distortion**. A sentence can be marked "not a requirement" with a wrong reason, or a Definition item can say the opposite of its source Node, and the CLI will not notice; it only puts the source text next to the item in the export so a reader can. Read the comparison.
- A review must cite evidence to count as reviewed, but the CLI cannot tell whether the cited artifact is the right one for that area. "Cited something" is the floor, not the bar.
- The CLI cannot verify who typed a confirmation. Only record a decision or approval after a real human said it.

## Docs

| | |
|---|---|
| [CLI reference](docs/cli.md) | every command, option and exit code |
| [Architecture](docs/architecture.md) | roles, storage, gates |
| [Artifact contracts](docs/artifact-contracts.md) | field-level schemas |
| [Installation](docs/installation.md) | pinned install, Skills, OpenSpec |
| [Roadmap](docs/roadmap.md) | Change 01–09 |

## Development

```bash
git clone https://github.com/gilgim/productkit.git && cd productkit
npm install && npm run build
npm test
```

Issues and pull requests are welcome. ProductKit's own development is managed with OpenSpec (`openspec/changes/`).

## License

[MIT](LICENSE)
