# farmall

Compile shared agent instructions, rules, skills, and subagents into the native files used by each supported tool.

Farmall runs configurable source, transform, lint, and output stages. It preserves files that have no Farmall ownership record and reports unsupported platform mappings instead of inventing conversions.

## Install

```bash
npm install --global farmall
```

The package version in this workspace is `0.0.2`. The current implementation includes `init`, `pull`, `sync`, `lint`, `check`, and `diff`.

## Quick use

```bash
farmall init

# Edit agent-config/AGENTS.md, rules/, skills/, and subagents/.
farmall check
farmall sync
```

`farmall init` creates `farmall.config.mjs` and the default `agent-config/` source directory. `check` and `diff` calculate the same plan as `sync` without writing files.

See the [quick start](./docs/getting-started/quick-start.md), [configuration reference](./docs/reference/configuration.md), and [platform matrix](./docs/concepts/platforms.md).

## Packages

| Package                     | Purpose                                               |
| --------------------------- | ----------------------------------------------------- |
| [`farmall`](./packages/cli) | Command-line interface                                |
| `@farmall/core`             | Reusable pipeline, plugin, planning, and apply engine |

## Develop

```bash
pnpm install
pnpm build
pnpm validate
pnpm --filter farmall dev -- --help

pnpm docs:dev
pnpm docs:check
pnpm docs:build
```

## License

MIT © Zac Rosenbauer
