# farmall

> **Status: WIP / placeholder release.** This reserves the name while the tool grows. Nothing syncs yet.

One source of truth for **all** your AI coding agents.

`farmall` keeps your **skills**, **rules**, and **subagents** in sync across Claude Code, Cursor,
Codex, Windsurf, Copilot, and opencode — then **lints them for cross-platform support**, so a skill
you write once actually _triggers_ everywhere instead of silently dropping fields on the agents that
don't understand them.

The sync problem is largely solved by great tools (rulesync, ruler). The part nobody does well yet —
and the reason this exists — is the **cross-agent quality/compat layer**: will this skill fire on
Codex the way it does on Claude, and which frontmatter fields get quietly ignored per agent?

## Why "farmall"?

The original Farmall tractor (International Harvester, 1924) earned its name because it could _farm
all_ the jobs on a farm — not just one. Same energy here: one tool that tends **all** your agents,
not some.

> We don't ~~farm~~ **agent** some.
> We ~~farm~~ **agent** all.

And it lives in the same yard as the rest of [thebytefarm](https://github.com/thebytefarm).

## Planned commands

```bash
farmall sync skills      # sync skills out to every platform
farmall sync rules       # sync rules (CLAUDE.md / AGENTS.md / .cursorrules / ...)
farmall sync subagents   # sync subagent definitions
farmall sync agents      # sync agents to each agent's config
farmall lint             # lint skills for cross-platform support
```

## Status

Early and intentionally minimal. Follow along — the real commands land soon.

## License

MIT © Zac Rosenbauer
