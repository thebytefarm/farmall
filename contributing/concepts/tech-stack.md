# Tech Stack

Complete reference of the tools and libraries used to build and maintain farmall.

## Toolchain

| Tool                                                                              | Purpose                       | Command / config                      |
| --------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------- |
| [pnpm](https://pnpm.io) (`11.10.0`)                                               | Package manager, workspaces   | `pnpm install`; `pnpm-workspace.yaml` |
| [Turbo](https://turbo.build) (`^2.10`)                                            | Monorepo task orchestration   | `turbo run <task>`; `turbo.json`      |
| [tsgo](https://github.com/microsoft/typescript-go) (`@typescript/native-preview`) | Typecheck & build (native TS) | `tsgo -p tsconfig.json`               |
| [oxlint](https://oxc.rs) (`^1.73`)                                                | Linting (Rust-based)          | `oxlint`                              |
| [oxfmt](https://oxc.rs) (`^0.58`)                                                 | Formatting (Rust-based)       | `oxfmt` / `oxfmt --check`             |
| [Vitest](https://vitest.dev) (`^3.2`)                                             | Test runner                   | `vitest run`                          |
| [ciderpress](https://www.npmjs.com/package/ciderpress) (`1.0.0-rc.4`)             | Docs site generator           | `ciderpress dev` / `build` / `check`  |
| [TypeScript](https://www.typescriptlang.org) (`^6.0`)                             | Type definitions / editor LSP | (types only; tsgo does the work)      |

> **Never** use ESLint, Prettier, or `tsc` in this repo. farmall is on the oxc toolchain: oxlint, oxfmt, and tsgo. Building with `tsc` or formatting with Prettier is a house-style violation the validate step will not catch — do not add them.

## Runtime Dependencies

These ship in the published `farmall` CLI (see `packages/cli/package.json`):

| Dependency  | Purpose                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| `maltty`    | ByteFarm CLI framework — command/middleware factories, context, terminal UI  |
| `massaman`  | Functional `Result` toolkit (targeted to replace the local `Result` in core) |
| `type-fest` | Advanced type utilities (dev dependency in cli)                              |

The engine's planned foundation dependency is [`@sentry/dotagents-lib`](https://github.com/getsentry/dotagents) for skill loading, source resolution, the git cache, and trust validation. It is **not yet installed** — see [Architecture › Foundation](./architecture.md#foundation).

## Root Scripts

Defined in the root `package.json`. Run all of these from the repo root.

| Script              | Runs                                                  | What it does                                            |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| `pnpm build`        | `turbo run build`                                     | tsgo-build every package to `dist/`                     |
| `pnpm dev`          | `turbo run dev`                                       | Watch mode across packages (`node --watch` for the CLI) |
| `pnpm typecheck`    | `turbo run typecheck`                                 | tsgo `--noEmit` per package                             |
| `pnpm test`         | `turbo run test`                                      | vitest across packages                                  |
| `pnpm lint`         | `oxlint`                                              | Lint the whole repo                                     |
| `pnpm format`       | `oxfmt`                                               | Format in place                                         |
| `pnpm format:check` | `oxfmt --check`                                       | Fail if anything is unformatted                         |
| `pnpm validate`     | `oxfmt --check && oxlint && turbo run typecheck test` | The full gate — run before every PR                     |
| `pnpm docs:dev`     | `ciderpress dev`                                      | Serve the docs site locally                             |
| `pnpm docs:build`   | `ciderpress build`                                    | Build the static docs site                              |
| `pnpm docs:check`   | `ciderpress check`                                    | Validate the docs (links, config)                       |

The turbo task graph (`turbo.json`) wires `typecheck`, `test`, and `build` to depend on upstream `^build`, so package builds run in dependency order. `dev` is `persistent` and uncached.

## TypeScript Configuration

Every package extends `tsconfig.base.json`. The base is strict and modern:

| Setting                                        | Value      | Why                                          |
| ---------------------------------------------- | ---------- | -------------------------------------------- |
| `target` / `lib`                               | `ES2023`   | Modern JS; matches Node >= 24                |
| `module` / `moduleResolution`                  | `NodeNext` | Native ESM, Node resolution                  |
| `strict`                                       | `true`     | All strict checks on                         |
| `noUncheckedIndexedAccess`                     | `true`     | Index access yields `T \| undefined`         |
| `exactOptionalPropertyTypes`                   | `true`     | `?` and `\| undefined` are distinct          |
| `verbatimModuleSyntax`                         | `true`     | Explicit `import type`; no elision surprises |
| `allowImportingTsExtensions`                   | `true`     | Import with `.ts` extension                  |
| `rewriteRelativeImportExtensions`              | `true`     | tsgo rewrites `.ts` → `.js` on emit          |
| `isolatedModules`                              | `true`     | Each file transpilable in isolation          |
| `declaration` / `declarationMap` / `sourceMap` | `true`     | Ship `.d.ts` + maps                          |

## Version Requirements

| Requirement | Minimum | Reason                                             |
| ----------- | ------- | -------------------------------------------------- |
| Node.js     | 24.x    | `engines.node: ">=24"`; native ESM, modern runtime |
| pnpm        | 11.10.0 | Pinned via `packageManager`                        |

## Excluded Technologies

Not used in this repo — reach for the replacement instead:

| Excluded | Use instead       | Reason                                 |
| -------- | ----------------- | -------------------------------------- |
| ESLint   | oxlint            | oxc toolchain; ESLint is slow          |
| Prettier | oxfmt             | oxc toolchain; oxfmt is Rust-based     |
| `tsc`    | tsgo              | Native TypeScript compiler, far faster |
| Jest     | Vitest            | Native ESM, faster                     |
| Classes  | factory + closure | ByteFarm functional house style        |

## References

- [Architecture](./architecture.md) — how these tools fit together
- [Getting Started](../guides/getting-started.md) — the setup and develop loop
- [maltty contributing standards](https://github.com/thebytefarm/maltty/tree/main/contributing/standards) — the canonical TypeScript/Git/docs rules
