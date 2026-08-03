# Introduction

`farmall` is one source of truth for **all** your AI coding agents.

You write your instructions, rules, skills, and subagents once — `farmall` syncs them out to Claude
Code, Cursor, Codex, Copilot, opencode, Devin, and pi, then **lints them for cross-platform support**
so they actually behave the same everywhere instead of silently degrading on the agents that don't
understand them.

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

## How it works

You author instructions once as `AGENTS.md` — the format nearly every agent reads — at the repo root
and nested wherever you want directory-scoped memory. Your rules, skills, and subagents live under one
source directory (`.farmall/` by default). `farmall sync` projects everything into each agent's
expected location by **symlink**, so there's one physical file to edit and nothing to drift.
`farmall lint` then checks whether that one file behaves on every agent it's linked into. See the
[Overview](../concepts/overview.md) for the full model.

## Status

Early and intentionally minimal. The name is reserved on npm, the scaffold is live, and the real
commands are landing next. Follow along.

## Why "farmall"?

The original Farmall tractor (International Harvester, 1924) earned its name because it could _farm
all_ the jobs on a farm — not just one. Same energy: one tool that tends **all** your agents, not
some.

## References

- [Quick Start](./quick-start.md)
- [Overview](../concepts/overview.md)
- [Define Once](../concepts/define-once.md)
- [Lint](../concepts/lint.md)
