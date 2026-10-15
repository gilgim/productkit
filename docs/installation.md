# ProductKit beta installation

This guide installs the same immutable ProductKit Git tag in personal and company development environments. Do not put a token or password in the URL.

## Access and prerequisites

- Node.js 20.19 or newer and npm.
- Git, with access to the GitHub repository. The repository is public; if you use a private fork, authenticate with an approved method such as Git Credential Manager, `gh` authentication, or the company's approved SSH agent.
- Claude Code or Codex installed and authenticated according to the user's own organization policy.

Company users must use the company-approved GitHub identity, repository access route, and AI tools. Never copy personal GitHub tokens, SSH private keys, Claude credentials, Codex credentials, or local `.env`, `.npmrc`, `.claude/settings.local.json`, `.aws`, or `.ssh` data between environments. Do not embed credentials in Git URLs or shell history.

## Install an exact release tag

Authenticate to GitHub with the approved method, then install the tag:

```sh
npm install --global "git+https://github.com/gilgim/productkit.git#v0.1.0-beta.1"
productkit --version
```

The expected version output is `0.1.0-beta.1`. The package's `prepare` script compiles TypeScript during npm's Git dependency packaging step; the installed package contains the compiled CLI and Skills, but not development dependencies. The Git install requires npm and Git to be able to access the repository.

To update, install the next approved tag explicitly using the same command and replace the tag. To roll back, install a previously approved tag the same way. Avoid an unpinned branch URL for repeatable environments.

## Agent Skills

**Install is all it takes.** `npm install --global` copies every Skill into `~/.claude/skills` and `~/.agents/skills`, so Claude Code and Codex see ProductKit in every project. If npm skipped install scripts, the first `productkit` run does it. Restart the agent once afterwards. Run `productkit install-skills` to repeat by hand (`--force` overwrites); set `PRODUCTKIT_SKIP_SKILLS=1` to opt out.

Describing a new product idea makes the `productkit` Skill ask whether to use ProductKit.

### Per-project copy (optional)

`productkit init` installs the Skills as part of the workspace. From the consuming project root:

```sh
productkit init
```

This copies each `SKILL.md` into both discovery paths:

```text
.claude/skills/<name>/SKILL.md     Claude Code
.agents/skills/<name>/SKILL.md     Codex
```

The files are copied, not symlinked. A copy keeps working after ProductKit is
uninstalled or moved, works on Windows without elevated permissions, and shows
up in `git diff` — so a team reviews a Skill change the same way it reviews any
other file. The cost is that a ProductKit upgrade does not update them; run
`productkit init` again to pull in new Skills.

An existing file is never overwritten. Running `init` a second time reports the
Skills as `skipped (exists)` and leaves local edits alone; to take the shipped
version of one, delete that file and run `init` again.

Pass `--no-skills` to create the workspace without touching `.claude/` or
`.agents/` — for a project that manages Skills centrally, or vendors them by
some other route.

Invoke a Skill by name in Claude Code (for example, `/clarify`); in Codex, ask
it to use the relevant ProductKit Skill. **Restart the agent after `init`** —
neither discovers Skills added during a running session.

## ProductKit and OpenSpec

ProductKit's normal installed runtime does not include OpenSpec. To run `productkit export openspec`, install the pinned validator in the consuming workspace so ProductKit can resolve it there:

```sh
npm install --save-dev @fission-ai/openspec@1.14.0
```

Export still requires a current ProductKit Approval and runs OpenSpec Strict Validation before publishing. The validator runs as a child process with a 30-second timeout. This is process separation, not an operating-system sandbox. OpenSpec 1.14.0 has a known High transitive dependency advisory; until upstream publishes a fix, run strict validation only on trusted workspaces. Do not treat the full OpenSpec dependency tree as vulnerability-free. ProductKit does not use `npm audit --force` to install a breaking downgrade.

## Workspace and user decisions

Run `productkit init` in the target app, then follow the relevant Skills and CLI help. The CLI checks structure, references and hashes; it does not perform semantic review or create user confirmations. Only the actual user may provide and record Clarification confirmation, relationship confirmation, Decisions, or final Approval. Never put real product data into this ProductKit source repository.

For a company workspace, follow company data-classification, retention, AI-tool, and repository policies before providing prompts or generated artifacts to an Agent. ProductKit does not authorize transferring company data to a personal account or service.
