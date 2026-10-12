# ProductKit beta installation

This guide installs the same immutable ProductKit Git tag in personal and company development environments. Replace `<OWNER>` with the private repository owner selected by the repository administrator; do not put a token or password in the URL.

## Access and prerequisites

- Node.js 20.19 or newer and npm.
- Access to the private `productkit` repository through an authentication method approved for that account and device, such as Git Credential Manager, `gh` authentication, or the company's approved SSH agent.
- Claude Code or Codex installed and authenticated according to the user's own organization policy.

Company users must use the company-approved GitHub identity, repository access route, and AI tools. Never copy personal GitHub tokens, SSH private keys, Claude credentials, Codex credentials, or local `.env`, `.npmrc`, `.claude/settings.local.json`, `.aws`, or `.ssh` data between environments. Do not embed credentials in Git URLs or shell history.

## Install an exact release tag

Authenticate to GitHub with the approved method, then install the tag:

```sh
npm install --global "git+https://github.com/<OWNER>/productkit.git#v0.1.0-beta.1"
productkit --version
```

The expected version output is `0.1.0-beta.1`. The package's `prepare` script compiles TypeScript during npm's Git dependency packaging step; the installed package contains the compiled CLI and Skills, but not development dependencies. The Git install requires npm and Git to be able to access the private repository.

To update, install the next approved tag explicitly using the same command and replace the tag. To roll back, install a previously approved tag the same way. Avoid an unpinned branch URL for repeatable environments.

## Connect Agent Skills

ProductKit ships shared `SKILL.md` directories. It does not edit the consuming project's `.claude/` or `.agents/` directories. Link only the needed skills into the project, and keep these machine-specific links out of shared source control unless the team intentionally maintains portable relative links.

On macOS/Linux, from the consuming project root:

```sh
PRODUCTKIT_ROOT="$(npm root -g)/productkit"
mkdir -p .claude/skills .agents/skills
for skill in clarify model graph challenge propose define validate; do
  ln -s "$PRODUCTKIT_ROOT/skills/$skill" ".claude/skills/$skill"
  ln -s "$PRODUCTKIT_ROOT/skills/$skill" ".agents/skills/$skill"
done
```

Claude Code discovers project Skills under `.claude/skills/<name>/SKILL.md`; invoke one by its Skill name (for example, `/clarify`). Codex can discover the same project-scoped Agent Skills under `.agents/skills/<name>/SKILL.md`; ask Codex to use the relevant ProductKit Skill. Start a new session if the Agent has not discovered newly linked Skills.

The commands above assume a global npm install. For a local npm prefix, replace `$(npm root -g)/productkit` with that prefix's `node_modules/productkit` path. On Windows, create directory junctions from an elevated or symlink-enabled PowerShell session, or copy the Skill directories into the same discovery paths; do not copy authentication settings.

## ProductKit and OpenSpec

ProductKit's normal installed runtime does not include OpenSpec. To run `productkit export openspec`, install the pinned validator in the consuming workspace so ProductKit can resolve it there:

```sh
npm install --save-dev @fission-ai/openspec@1.14.0
```

Export still requires a current ProductKit Approval and runs OpenSpec Strict Validation before publishing. The validator runs as a child process with a 30-second timeout. This is process separation, not an operating-system sandbox. OpenSpec 1.14.0 has a known High transitive dependency advisory; until upstream publishes a fix, run strict validation only on trusted workspaces. Do not treat the full OpenSpec dependency tree as vulnerability-free. ProductKit does not use `npm audit --force` to install a breaking downgrade.

## Workspace and user decisions

Run `productkit init` in the target app, then follow the relevant Skills and CLI help. The CLI checks structure, references and hashes; it does not perform semantic review or create user confirmations. Only the actual user may provide and record Clarification confirmation, relationship confirmation, Decisions, or final Approval. Never put real product data into this ProductKit source repository.

For a company workspace, follow company data-classification, retention, AI-tool, and repository policies before providing prompts or generated artifacts to an Agent. ProductKit does not authorize transferring company data to a personal account or service.
