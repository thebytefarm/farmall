# Get Started Contributing

Set up your local environment to contribute to farmall.

> **Status: WIP.** The tool doesn't sync anything yet — the CLI is a stub and `@farmall/core` returns placeholders. You're contributing to the scaffold, toolchain, docs, and (soon) the engine. See [Architecture](./concepts/architecture.md) for what's built vs planned.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 24 (`engines.node` in the root `package.json`)
- [pnpm](https://pnpm.io/) 11.10.0 (`corepack enable` to activate the pinned version)
- [Git](https://git-scm.com/)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (optional but recommended)

## Steps

### 1. Fork and clone

```bash
gh repo fork thebytefarm/farmall --clone
cd farmall
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Build

Build every package to `dist/` (tsgo, in dependency order via turbo):

```bash
pnpm build
```

### 4. Run the full gate

`validate` is the single command CI and reviewers expect to pass:

```bash
pnpm validate    # oxfmt --check && oxlint && turbo run typecheck test
```

### 5. Run the CLI in watch mode

```bash
pnpm --filter farmall dev
```

The CLI is a placeholder today — `farmall --help` prints the planned command surface and any real subcommand replies that it isn't wired up yet. That entrypoint is what you extend when [adding a command](./guides/adding-a-cli-command.md).

### 6. Run the docs site (optional)

```bash
pnpm docs:dev      # serve the ciderpress docs site locally
pnpm docs:build    # build the static site
pnpm docs:check    # validate links and config
```

### 7. Understand the project

Read in this order:

1. [`VISION.md`](https://github.com/thebytefarm/farmall/blob/main/VISION.md) — the product spec: commands, sync targets, platforms, the config file, and why lint is the differentiator
2. [`contributing/concepts/architecture.md`](./concepts/architecture.md) — package ecosystem and the source-of-truth → sync → lint pipeline
3. [`contributing/concepts/tech-stack.md`](./concepts/tech-stack.md) — the toolchain and root scripts
4. [`docs/concepts/`](../docs/concepts/overview.md) — the product-facing concept pages (overview, targets, sync, lint, platforms) for context on what the tool will do

## Scripts Reference

All run from the repo root. Do not `cd` into a package — use `--filter` when you need to scope.

| Script                      | Purpose                                                |
| --------------------------- | ------------------------------------------------------ |
| `pnpm build`                | Build all packages                                     |
| `pnpm dev`                  | Watch mode across packages                             |
| `pnpm typecheck`            | tsgo typecheck                                         |
| `pnpm test`                 | vitest                                                 |
| `pnpm lint`                 | oxlint                                                 |
| `pnpm format`               | oxfmt (in place)                                       |
| `pnpm format:check`         | oxfmt --check                                          |
| `pnpm validate`             | The full gate (format check + lint + typecheck + test) |
| `pnpm docs:dev`             | Serve docs locally                                     |
| `pnpm docs:build`           | Build docs                                             |
| `pnpm docs:check`           | Validate docs                                          |
| `pnpm --filter farmall dev` | Run only the CLI in watch mode                         |

## Branch and Commit Conventions

- **Never commit to `main`.** Branch first.
- Branch names follow Conventional Commits type prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`.

```bash
git checkout main
git pull origin main
git checkout -b feat/lint-trigger-compat
```

- Commit messages use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`.

```bash
git commit -m "feat(cli): add lint subcommand skeleton"
```

- Open PRs against `main`. Run `pnpm validate` before pushing.

## Verification

Confirm the gate is green:

```bash
pnpm build
pnpm validate
```

## Troubleshooting

### pnpm not found

**Issue:** Running `pnpm` returns "command not found."

**Fix:**

```bash
corepack enable
```

### Wrong Node version

**Issue:** Install or build fails with an engines warning.

**Fix:** Use Node 24 or newer (`node --version`). Switch with your version manager (`nvm use 24`, `fnm use 24`, etc.).

### Build binaries blocked

**Issue:** pnpm refuses to run a package's build/postinstall script.

**Fix:** The allowlist lives in `pnpm-workspace.yaml` (`allowBuilds` and `minimumReleaseAgeExclude`). If you add a dependency that needs a build step, add it there rather than disabling the guard globally.

## References

- [Architecture](./concepts/architecture.md)
- [Tech Stack](./concepts/tech-stack.md)
- [Adding a CLI Command](./guides/adding-a-cli-command.md)
- [VISION.md](https://github.com/thebytefarm/farmall/blob/main/VISION.md)
