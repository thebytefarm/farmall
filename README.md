<div align="center">
  <img src="https://placehold.co/1200x300/0d1117/e6edf3?text=farmall" alt="farmall" width="90%" />
  <p><strong>Farm all your agents.</strong></p>
  <p>One source of truth for every AI coding agent — sync skills, rules & subagents, then lint them for cross-platform support.</p>

<a href="https://www.npmjs.com/package/farmall"><img src="https://img.shields.io/npm/v/farmall" alt="npm version" /></a>
<a href="https://github.com/thebytefarm/farmall/blob/main/LICENSE"><img src="https://img.shields.io/github/license/thebytefarm/farmall" alt="License" /></a>

<a href="https://github.com/thebytefarm/farmall/tree/main/docs">📖 Documentation</a> &nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp; <a href="https://github.com/thebytefarm/farmall/issues">🐛 Issues</a>

</div>

> **WIP** — the name is reserved, the scaffold is live, and the real commands are landing next.

`farmall` keeps your **skills**, **rules**, and **subagents** in sync across Claude Code, Cursor,
Codex, Windsurf, Copilot, and opencode — then **lints them for cross-platform support**, so a skill
you write once actually _triggers_ everywhere instead of silently dropping fields on the agents that
don't understand it.

> We don't ~~farm~~ **agent** some.
> We ~~farm~~ **agent** all.

## Packages

| Package                     | Description                |
| --------------------------- | -------------------------- |
| [`farmall`](./packages/cli) | The CLI. Published to npm. |
| `@farmall/core`             | Internal engine (private). |

## Develop

```bash
pnpm install
pnpm build       # tsgo build all packages
pnpm validate    # oxfmt + oxlint + typecheck + test
pnpm --filter farmall dev

pnpm docs:dev    # run the ciderpress docs site locally
pnpm docs:build  # build the docs site
```

Part of [thebytefarm](https://github.com/thebytefarm).

## License

MIT © Zac Rosenbauer
