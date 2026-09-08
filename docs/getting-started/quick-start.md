# Quick start

## Install

```bash
npm install --global farmall
farmall --version
```

## Initialize a repository

Run Farmall at the repository root:

```bash
farmall init
```

The command creates two files with create-only writes:

```text
farmall.config.mjs
agent-config/README.md
```

If either destination already contains different content, initialization stops with a conflict rather than replacing it.

## Add shared configuration

The default source layout is:

```text
agent-config/
  AGENTS.md
  rules/
    backend/typescript.md
  skills/
    review/
      SKILL.md
      references/checklist.md
  subagents/
    research/scout.md
  outputs/
    claude-code/
      .claude/settings.json
```

Only files matching configured source patterns become normalized artifacts. Skill directories are bundles, so the output includes `SKILL.md` and sibling files such as scripts or references.

## Preview and apply

```bash
farmall lint
farmall check
farmall diff
farmall sync
```

`lint` reports configured diagnostics. `check` prints diagnostics and planned actions. `diff` prints file content changes. Neither `check` nor `diff` writes outputs or ownership state. Both exit with status 1 when changes are pending.

`sync` refuses error-level diagnostics and conflicts, verifies that destinations have not changed since planning, then applies the complete plan.

## Import an existing platform

The generated `pull` pipeline imports Claude Code artifacts into the normalized filesystem layout with create-only writes:

```bash
farmall pull
```

Edit the `pull` pipeline to select another supported `farmall:platform-source` platform or a custom import pipeline. Pull does not import native settings files because no lossless reverse mapping is defined for them.

## Select config and pipeline

```bash
farmall check --config ./config/farmall.json --pipeline release
farmall sync --pipeline release --json
farmall pull --pipeline import-cursor
```

`pull`, `sync`, `lint`, `check`, and `diff` accept `--config`, `--pipeline`, and `--json`. `init` accepts `--json` only.
