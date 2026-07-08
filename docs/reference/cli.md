# CLI

The `farmall` command surface. Six commands: `init`, `pull`, `sync`, `lint`, `check`, `diff`.

> **WIP.** `farmall` is a placeholder release today. The commands below are the plan, not yet the
> behavior — `farmall --help` prints this surface; everything else is a friendly "not wired up yet."

## Synopsis

```bash
farmall <command> [target] [flags]
```

`target` is one of `instructions`, `rules`, `skills`, `subagents`, `agents`. Omit it to act on every
enabled target.

## `farmall init`

Scaffold a source-of-truth directory and a `farmall.config.ts` in your repo.

```bash
farmall init
farmall init --source .agents
```

| Flag          | Type       | Description                                      |
| ------------- | ---------- | ------------------------------------------------ |
| `--source`    | `string`   | Source directory to create (default `.farmall`). |
| `--platforms` | `string[]` | Platforms to pre-populate in config.             |

## `farmall pull`

Import existing per-agent config into the source of truth. Reads what's already in `.claude/`,
`.cursor/`, `AGENTS.md`, and friends, and consolidates it under `source`.

```bash
farmall pull
farmall pull skills --platform claude-code
```

| Flag         | Type      | Description                                  |
| ------------ | --------- | -------------------------------------------- |
| `--platform` | `string`  | Pull from a single platform.                 |
| `--dry-run`  | `boolean` | Show what would be imported without writing. |

## `farmall sync <target>`

Project the source of truth out to every configured platform by symlink. Idempotent.

```bash
farmall sync
farmall sync skills
farmall sync rules --platform cursor
```

| Flag         | Type      | Description                |
| ------------ | --------- | -------------------------- |
| `--platform` | `string`  | Sync to a single platform. |
| `--dry-run`  | `boolean` | Alias for `farmall check`. |

See [Sync](../concepts/sync.md).

## `farmall lint`

Check artifacts for cross-platform support. Exits non-zero if any `error`-severity rule fails.

```bash
farmall lint
farmall lint skills
```

| Flag         | Type     | Description                       |
| ------------ | -------- | --------------------------------- |
| `--platform` | `string` | Lint against a single platform.   |
| `--format`   | `string` | Output format (`pretty`, `json`). |

See [Lint](../concepts/lint.md) and the [rule catalog](./lint-rules.md).

## `farmall check`

Dry-run. Reports what `sync` would change, what's out of sync, and what's broken — without writing.

```bash
farmall check
```

## `farmall diff`

Show drift between the source of truth and each agent's on-disk config.

```bash
farmall diff
farmall diff --platform claude-code
```

## Global flags

| Flag        | Description                        |
| ----------- | ---------------------------------- |
| `--help`    | Print the command surface.         |
| `--version` | Print the installed version.       |
| `--config`  | Path to a non-default config file. |

## References

- [Config Reference](./config.md)
- [Support Matrix](./support-matrix.md)
- [Sync](../concepts/sync.md)
- [Lint](../concepts/lint.md)
