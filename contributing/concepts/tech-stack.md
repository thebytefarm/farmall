# Tech stack

Farmall is a TypeScript monorepo targeting Node.js 26.

## Runtime and tooling

| Tool                      | Purpose                      | Version                |
| ------------------------- | ---------------------------- | ---------------------- |
| Node.js                   | Runtime                      | `>=26`                 |
| pnpm                      | Package manager              | `12.3.4`               |
| TypeScript native preview | Typecheck and build          | `7.0.0-dev.20260707.2` |
| Turborepo                 | Workspace task orchestration | `^2.10.12`             |
| Vitest                    | Tests                        | `^5.0.0`               |
| oxlint                    | Linting                      | `^1.81.0`              |
| oxfmt                     | Formatting                   | `^0.66.0`              |
| Ciderpress                | Documentation site           | `1.0.0-rc.15`          |

The source is ESM-only and uses strict TypeScript with `NodeNext` module resolution.

## Runtime dependencies

| Dependency              | Package | Purpose                                           |
| ----------------------- | ------- | ------------------------------------------------- |
| Maltty                  | CLI     | Command definitions, parsing, help, and failures  |
| `jiti`                  | CLI     | Runtime support for executable TypeScript         |
| Zod                     | Both    | Runtime input and configuration validation        |
| `@sentry/dotagents-lib` | Core    | Markdown frontmatter parsing                      |
| `massaman`              | Both    | Exhaustive matching and immutable transformations |
| YAML                    | Core    | YAML configuration parsing                        |

The CLI uses `maltty@1.0.0-rc.2`. Each package manifest is authoritative for that package. Runtime version output reads the installed manifest rather than duplicating a version in source.

## Packages

| Package         | Visibility | Role                                         |
| --------------- | ---------- | -------------------------------------------- |
| `farmall`       | Public     | CLI executable                               |
| `@farmall/core` | Published  | Pipeline, plugin, planning, and apply engine |

## Commands

| Command             | Purpose                                 |
| ------------------- | --------------------------------------- |
| `pnpm build`        | Build every package                     |
| `pnpm typecheck`    | Typecheck every package                 |
| `pnpm test`         | Run package tests                       |
| `pnpm lint`         | Run oxlint                              |
| `pnpm format`       | Format with oxfmt                       |
| `pnpm format:check` | Check formatting                        |
| `pnpm validate`     | Format check, lint, typecheck, and test |
| `pnpm docs:dev`     | Run the documentation site locally      |
| `pnpm docs:check`   | Validate documentation                  |
| `pnpm docs:build`   | Build the documentation site            |

`pnpm validate` is the repository completion gate. It runs `oxfmt --check`, `oxlint`, and each package's typecheck and test tasks through Turborepo.

## Tests and coverage

Vitest runs colocated `*.test.ts` files. Core has unit and filesystem integration coverage for config loading, plugins, built-ins, pipeline execution, project operations, planning, apply, rollback, and Result helpers. CLI tests cover rendering and execute the built command against temporary repositories.

Farmall requires 100% statement, branch, function, and line coverage for `packages/core/src/**/*.ts`. This is an explicit project requirement, not a general recommendation. The thresholds live in `packages/core/vitest.config.ts`.

```bash
pnpm --filter @farmall/core exec vitest run --coverage
```

## Excluded tooling

- Use **oxlint**, not ESLint.
- Use **oxfmt**, not Prettier.
- Use **tsgo**, not `tsc`.
- Prefer factories and closures over classes.
- Do not use `Set`, `Map`, `WeakSet`, or `WeakMap`. Use readonly arrays, readonly records, and `massaman` helpers.

## References

- [Architecture](./architecture.md)
- [TypeScript coding style](../standards/typescript/coding-style.md)
