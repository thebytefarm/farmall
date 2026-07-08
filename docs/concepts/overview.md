# Overview

`farmall` has one job: keep **one source of truth** for your agent config, and project it out to
**every** agent you use — correctly.

## The model

```
                    ┌─────────────┐
   your source ───▶ │   farmall   │ ───▶ Claude Code
   of truth         │  sync+lint  │ ───▶ Cursor
                    └─────────────┘ ───▶ Codex
                          │          ───▶ Windsurf
                          │          ───▶ Copilot
                          ▼          ───▶ opencode
                    cross-platform
                    lint report
```

## What it syncs

| Target        | What it is                                                             |
| ------------- | ---------------------------------------------------------------------- |
| **skills**    | reusable agent skills (`SKILL.md` and friends)                         |
| **rules**     | project rules — `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and variants |
| **subagents** | subagent definitions                                                   |
| **agents**    | agent-level config written to each tool's expected location            |

## The part that matters: lint

Copying files everywhere is the easy half. The hard half is knowing whether the copy actually
_works_ on each target. `farmall lint` is built for exactly this:

- **Trigger compatibility** — does the skill's description fire on each agent, or only on the one you
  wrote it for?
- **Frontmatter drift** — which fields does each agent honor, and which does it silently drop?
- **Portability** — will a subagent written for one tool run on another at all?

Sync gets your config _there_. Lint tells you whether it will _behave_ once it arrives.

## Supported platforms

Claude Code · Cursor · Codex · Windsurf · Copilot · opencode — with more as the ecosystem grows.
