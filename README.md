# farmall

> One source of truth for **all** your AI coding agents. **WIP.**

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
```

Part of [thebytefarm](https://github.com/thebytefarm).

## License

MIT © Zac Rosenbauer
