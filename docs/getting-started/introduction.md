# Introduction

`farmall` is one source of truth for **all** your AI coding agents.

You write a skill, a rule, or a subagent once — `farmall` syncs it out to Claude Code, Cursor, Codex,
Windsurf, Copilot, and opencode, then **lints it for cross-platform support** so it actually behaves
the same everywhere instead of silently degrading on the agents that don't understand it.

> We don't ~~farm~~ **agent** some.
> We ~~farm~~ **agent** all.

## Why it exists

Keeping agent config in sync across tools is a real chore, and most of the sync problem is already
solved well by tools like [rulesync](https://github.com/dyoshikawa/rulesync) and
[ruler](https://github.com/intellectronica/ruler). The part **nobody does well yet** — and the reason
`farmall` exists — is the cross-agent _quality_ layer:

- **Will this skill actually trigger** on Codex the way it does on Claude?
- **Which frontmatter fields get silently dropped** per agent?
- **Are your subagents portable**, or do they only work in one tool?

`farmall` treats your agent config as source you can lint, not just files you copy around.

## Status

Early and intentionally minimal. The name is reserved on npm, the scaffold is live, and the real
commands are landing next. Follow along.

## Why "farmall"?

The original Farmall tractor (International Harvester, 1924) earned its name because it could _farm
all_ the jobs on a farm — not just one. Same energy: one tool that tends **all** your agents, not
some.
