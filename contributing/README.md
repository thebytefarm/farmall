# Contributing

Welcome to the farmall contributing docs. This directory holds the standards, concepts, and guides for working in this codebase.

> **Status: WIP.** farmall is a placeholder release today — it reserves the name and ships the scaffold, docs, and toolchain. Most command internals described in the product docs do not exist yet. These contributing docs describe the repo as it is now and flag planned-vs-built where it matters.

## How to Use

- **Standards** define the rules — read the relevant standard before writing code or docs.
- **Concepts** explain the "what" and "why" behind key architectural decisions.
- **Guides** are step-by-step walkthroughs for common tasks.

## Table of Contents

### Standards

farmall follows the ByteFarm house style. Rather than duplicate it, read the standards that already live in the repo and its sibling projects:

- [Root README](https://github.com/thebytefarm/farmall/blob/main/README.md) — package layout, develop loop, house conventions
- [`packages/cli/README.md`](https://github.com/thebytefarm/farmall/blob/main/packages/cli/README.md) — the published CLI, planned command surface
- [maltty contributing standards](https://github.com/thebytefarm/maltty/tree/main/contributing/standards) — the canonical TypeScript, Git, and documentation standards for all ByteFarm repos. farmall shares this house style verbatim.

The short version of the rules the toolchain enforces:

| Area          | Rule                                                                                    |
| ------------- | --------------------------------------------------------------------------------------- |
| Lint / format | oxlint + oxfmt. Never ESLint, Prettier, or `tsc`.                                       |
| Typecheck     | tsgo (`@typescript/native-preview`), not `tsc`.                                         |
| Style         | Functional, immutable, `const` only. Factory functions over classes. Return `Result`.   |
| Commits       | [Conventional Commits](https://www.conventionalcommits.org/). Never commit to `main`.   |
| Emojis        | None in code, commits, or docs unless the existing file already uses them (README art). |

### Concepts

- [Architecture](./concepts/architecture.md) — package ecosystem, the source-of-truth → sync → lint pipeline, the `@sentry/dotagents-lib` foundation
- [Tech Stack](./concepts/tech-stack.md) — toolchain reference: pnpm, turbo, tsgo, oxlint, oxfmt, vitest, ciderpress

### Guides

- [Getting Started](./guides/getting-started.md) — local setup, scripts, reading order, branch conventions
- [Adding a CLI Command](./guides/adding-a-cli-command.md) — end-to-end walkthrough for a new `farmall` subcommand

## References

- [VISION.md](https://github.com/thebytefarm/farmall/blob/main/VISION.md) — the product spec and roadmap
- [docs/concepts/](../docs/concepts/overview.md) — product-facing concept pages (overview, targets, sync, lint, platforms)
