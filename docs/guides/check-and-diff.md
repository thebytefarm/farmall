# Check and Diff

Two read-only commands for before you sync and after you've drifted. `farmall check` tells you what `sync` would do; `farmall diff` tells you where an agent's on-disk config has diverged from the source.

> **WIP.** This page describes the design. `check` and `diff` aren't wired up yet.

## sync vs check vs diff

| Command         | Writes? | Answers                                          |
| --------------- | ------- | ------------------------------------------------ |
| `farmall sync`  | yes     | Make the links match the source and config.      |
| `farmall check` | no      | What _would_ sync change, and what's broken?     |
| `farmall diff`  | no      | Where has an agent's config drifted from source? |

`check` looks forward — the plan `sync` would execute. `diff` looks at what's already wrong — a real file where a symlink should be, or a link pointing at the wrong source. `sync` is the only one that touches disk.

## farmall check

Run it before syncing, or in CI to assert the tree is already converged:

```bash
farmall check
```

An illustrative report:

```
farmall check — .farmall → 4 platforms

  would create
    .cursor/skills/review-pr/SKILL.md   → .farmall/skills/review-pr/SKILL.md
    .github/copilot-instructions.md     → .farmall/AGENTS.md

  would prune
    .claude/rules/legacy.md             (source removed)

  broken
    .claude/skills/deploy/SKILL.md      real file, not a symlink — pull or remove it

  up to date
    12 links match source and config

  2 to create, 1 to prune, 1 broken
```

`check` reports three kinds of change — links `sync` would **create**, links it would **prune** (target or platform turned off, or source deleted), and anything **broken** it won't touch, like a real file sitting where a symlink belongs. It's the same plan `sync` runs; `farmall sync --dry-run` is an alias for it.

## farmall diff

Where `check` reasons about the link tree, `diff` reasons about content — it surfaces drift between the source of truth and what an agent actually reads:

```bash
farmall diff
farmall diff --platform claude-code
```

```
farmall diff — .farmall vs on-disk

  .claude/skills/deploy/SKILL.md
    not a symlink — 14 lines differ from .farmall/skills/deploy/SKILL.md
    - description: Deploy the app.
    + description: Deploy the application to staging or production.

  .cursor/rules/typescript.mdc
    symlink target missing — points at .farmall/rules/typescript.md (deleted)

  1 drifted, 1 dangling
```

In a repo synced entirely by symlink there's nothing to drift — that's the design. `diff` earns its keep on repos mid-adoption, where someone hand-edited a projected copy before it was linked, or a source file was deleted out from under a link. It's how you find the copies [`pull`](./adopt-into-a-repo.md) still needs to consolidate.

## The usual loop

```bash
farmall diff        # anything drifted or dangling?
farmall check       # what would sync do about it?
farmall sync        # do it
```

`diff` finds the mess, `check` shows the plan, `sync` executes. Only the last one writes.

## References

- [Sync](../concepts/sync.md)
- [CLI Reference](../reference/cli.md)
- [Adopt farmall into a Repo](./adopt-into-a-repo.md)
- [Lint](../concepts/lint.md)
