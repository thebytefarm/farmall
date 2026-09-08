# Develop a feature

Ship a Farmall change from a focused branch through review.

## Prerequisites

- Complete [Getting started](./getting-started.md).
- Read the relevant [standards](../README.md).

## Steps

### 1. Create a branch

Start from an up-to-date `main` branch. Use Worktrunk to create feature worktrees:

```bash
git pull --ff-only origin main
wt switch --create feat/my-feature --base main
```

Use `<type>/<short-description>` branch names such as `feat/add-platform-adapter` or `fix/config-discovery`.

### 2. Make the change

- Keep process I/O and terminal rendering in `packages/cli`.
- Keep config, plugin, pipeline, lint, planning, and apply behavior in `packages/core`.
- Return expected core failures as `Result<T, CoreError>` and unwrap them at the CLI boundary.
- Let output plugins produce desired files; route all filesystem changes through the central planner.
- Do not use `Set`, `Map`, `WeakSet`, or `WeakMap`.
- Follow the [TypeScript standards](../standards/typescript/coding-style.md).
- Update docs when behavior or command syntax changes.

### 3. Add tests

Colocate tests with source files as `*.test.ts`. Use temporary directories for filesystem behavior. Test success, expected `Result` failures, containment, conflicts, and rollback where they apply.

Core changes must preserve 100% statement, branch, function, and line coverage. CLI behavior belongs in `cli.integration.test.ts`; formatting behavior belongs in `output.test.ts`, and exit policy belongs in `exit-status.test.ts`.

```bash
pnpm test
pnpm --filter @farmall/core exec vitest run --coverage
```

### 4. Validate

```bash
pnpm validate
pnpm docs:check
```

Run `pnpm format` first if the format check reports changes.

### 5. Commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(core): add Claude Code adapter"
```

See [Commit standards](../standards/git-commits.md) for types, scopes, and breaking changes.

### 6. Push and open a PR

```bash
git push -u origin feat/my-feature
gh pr create
```

Target `main`. Keep the PR to one concern and use a Conventional Commit title.

### 7. Merge

Merge only after review and green CI. Prefer squash merge so the PR title becomes the commit on `main`.

## Verification

Before requesting review, confirm:

1. `pnpm validate` passes.
2. `pnpm docs:check` passes for documentation changes.
3. Core coverage remains 100% for statements, branches, functions, and lines.
4. The PR title follows `type(scope): description`.
5. The diff contains no generated files, credentials, or unrelated changes.

## References

- [Getting started](./getting-started.md)
- [Commit standards](../standards/git-commits.md)
- [Pull request standards](../standards/git-pulls.md)
- [Architecture](../concepts/architecture.md)
