# Quick Start

> **WIP.** `farmall` is a placeholder release today — the commands below are the plan, not yet the
> behavior. Installing it now just reserves your spot.

## Install

```bash
npm install -g farmall
# or run it without installing
npx farmall --help
```

## Planned commands

```bash
farmall sync skills      # sync skills out to every platform
farmall sync rules       # sync rules (CLAUDE.md / AGENTS.md / .cursorrules / ...)
farmall sync subagents   # sync subagent definitions
farmall sync agents      # sync agents to each agent's config
farmall lint             # lint skills for cross-platform support
```

## What works today

```bash
farmall --help           # prints the planned command surface
farmall --version        # 0.0.1
```

Everything else is a friendly "not wired up yet." That's on purpose — the shape is real, the logic is
coming.
