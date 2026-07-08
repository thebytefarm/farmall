# Architecture

High-level overview of how farmall is structured, what it layers on top of, and how config is meant to flow from one source of truth out to every agent.

> **Status: WIP.** The scaffold, toolchain, and docs are real. The pipeline below — sync, lint, `pull`, config resolution — is the intended design, not the current code. `@farmall/core` today exports type stubs and `not implemented yet` placeholders. Read this as the target architecture; check the source before assuming a piece exists.

## Overview

farmall keeps one source of truth for your AI coding agent config — instructions, rules, skills, subagents, agents — and projects it out to every platform (Claude Code, Cursor, Codex, Copilot, opencode, Devin, pi) by **symlink**, then **lints** the result for cross-platform compatibility.

The codebase follows the ByteFarm functional, immutable, composition-first house style: no classes, no `let`, no `throw`. Expected failures return a `Result`. Side effects (process exit, filesystem writes, terminal output) sit at the outermost edges.

## Package Ecosystem

```
farmall/
├── packages/
│   ├── cli/            # `farmall` bin — published to npm (the CLI surface)
│   └── core/           # @farmall/core — internal engine (private)
├── docs/               # product-facing docs (ciderpress site)
├── contributing/       # this directory — sourced into the docs site
├── VISION.md           # product spec + roadmap
├── turbo.json          # task graph (build, typecheck, test, dev)
├── pnpm-workspace.yaml # workspace + build allowlists
└── ciderpress.config.ts # docs site config
```

| Package         | Published | Purpose                                                                 |
| --------------- | --------- | ----------------------------------------------------------------------- |
| `farmall`       | yes (npm) | The CLI. Argument parsing, command routing, terminal output.            |
| `@farmall/core` | no        | The engine: source resolution, sync (symlink) projection, lint, config. |

The CLI depends on [`maltty`](https://github.com/thebytefarm/maltty) (the ByteFarm CLI framework) and `massaman` (a functional `Result` toolkit). It is expected to grow to depend on `@farmall/core` for the actual work; today it is a self-contained `parseArgs` stub in `packages/cli/src/index.ts`.

## The Pipeline

The product is three stages over one source directory (`.farmall/` by default):

```
                    ┌──────────────────────────────────────────┐
                    │  .farmall/  (the one source of truth)      │
                    │  instructions · rules · skills ·           │
                    │  subagents · agents                        │
                    └──────────────────────────────────────────┘
                            │                        ▲
              (1) pull      │                        │  authored by you
              import        │                        │
              existing ─────┘                        │
              per-agent config                       │
                            │
                            ▼
                    ┌──────────────────┐
              (2)   │   sync (symlink) │   one physical file, many links —
              sync  │   projection      │   never a second copy to drift
                    └──────────────────┘
                            │
             ┌──────────────┼──────────────┬──────────────┬──────────────┐
             ▼              ▼               ▼              ▼              ▼
        .claude/       .cursor/        .codex/        AGENTS.md      .github/...
        (Claude Code)  (Cursor)        (Codex)        (opencode…)    (Copilot)
             │              │               │              │              │
             └──────────────┴───────┬───────┴──────────────┴──────────────┘
                                     ▼
                            ┌──────────────────┐
                      (3)   │       lint       │   does the projected config
                      lint  │  cross-platform  │   actually *behave* on each agent?
                            └──────────────────┘
```

1. **`pull`** — import config that already exists per-agent back into `.farmall/`, so you can adopt farmall without hand-wiring an existing repo.
2. **`sync`** — project the source out to each agent's expected path as a **symlink**. One physical `SKILL.md`; each runtime reads the same file and drops the frontmatter keys it doesn't understand. Sync is idempotent and never writes into the source directory. See [docs/concepts/sync.md](../../docs/concepts/sync.md).
3. **`lint`** — the differentiator. Everyone can copy files; nobody checks whether the copy _works_. Lint answers trigger compatibility, frontmatter drift, and portability per platform. See [docs/concepts/lint.md](../../docs/concepts/lint.md).

`check` (dry-run: what would sync change) and `diff` (where has an agent drifted from source) are the read-only counterparts to `sync`.

## Foundation

farmall does not rebuild the commodity. Skill loading, source resolution, the git cache, and trust validation are meant to come from [`@sentry/dotagents-lib`](https://github.com/getsentry/dotagents) (MIT, one dependency). That library is grammar-agnostic — it knows source strings, `SKILL.md`, and the cache, not farmall's config — so farmall depends on the plumbing without inheriting a manifest format.

What farmall layers on top is the work nobody else does well:

| Layer               | Owner                      | Status  |
| ------------------- | -------------------------- | ------- |
| Skill loading       | `@sentry/dotagents-lib`    | planned |
| Source resolution   | `@sentry/dotagents-lib`    | planned |
| Git cache & trust   | `@sentry/dotagents-lib`    | planned |
| **Sync (symlink)**  | `@farmall/core`            | planned |
| **`pull`**          | `@farmall/core`            | planned |
| **Rules sync**      | `@farmall/core`            | planned |
| **Lint**            | `@farmall/core`            | planned |
| **Config resolver** | `@farmall/core`            | planned |
| CLI surface         | `farmall` (`packages/cli`) | stub    |

## Configuration

`farmall.config.ts` (also `.js`, `.yaml`, `.json`) is the single source of truth for what's supported and how it syncs — type-safe via a `defineConfig` export from the `farmall` package. It declares the target/platform support matrix, per-target args (output paths, formats, include/exclude globs), and lint rules with per-platform overrides. See [VISION.md](https://github.com/thebytefarm/farmall/blob/main/VISION.md) and [docs/concepts/configuration.md](../../docs/concepts/configuration.md) for the full shape. Not implemented yet.

## Current State of `@farmall/core`

`packages/core/src/index.ts` today is deliberately minimal:

- A local `Result<T, E>` type with `ok` / `err` constructors, tagged as temporary until `massaman`'s `Result` is wired in.
- `SYNC_TARGETS` and `PLATFORMS` constants with their derived union types.
- `sync()` and `lintSkills()` functions that return `ok("… — not implemented yet")`.

> **Discrepancy to fix, not follow.** The `PLATFORMS` list in `core/src/index.ts` and the `SYNC_TARGETS` list drift from the canonical sets in [VISION.md](https://github.com/thebytefarm/farmall/blob/main/VISION.md). VISION.md is authoritative: seven platforms (`claude-code`, `cursor`, `codex`, `copilot`, `opencode`, `devin`, `pi`) and five targets (`instructions`, `rules`, `skills`, `subagents`, `agents`). The core stub omits `instructions`, `devin`, and `pi` and includes `windsurf`. When the engine is built out, reconcile it against VISION.md.

## Design Decisions

1. **Symlink, not copy** — one physical file per artifact; every agent links to it. Nothing to re-sync after an edit.
2. **Depend on the plumbing, own the differentiator** — reuse `@sentry/dotagents-lib` for loading/cache/trust; spend effort on lint, rules sync, and `pull`.
3. **Config as a support matrix** — `farmall.config.ts` declares what syncs where and how lint behaves, per platform.
4. **Functional, immutable** — `Result` for expected failures, factories over classes, side effects at the edges (ByteFarm house style).
5. **CLI over the framework** — the `farmall` bin builds on `maltty` for parsing/routing rather than hand-rolling it (once wired up).

## References

- [Tech Stack](./tech-stack.md)
- [VISION.md](https://github.com/thebytefarm/farmall/blob/main/VISION.md)
- [docs/concepts/overview.md](../../docs/concepts/overview.md)
- [docs/concepts/sync.md](../../docs/concepts/sync.md)
- [docs/concepts/lint.md](../../docs/concepts/lint.md)
