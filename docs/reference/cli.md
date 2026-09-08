# CLI reference

## Commands

| Command         | Default pipeline | Writes | Purpose                                                                           |
| --------------- | ---------------- | ------ | --------------------------------------------------------------------------------- |
| `farmall init`  | Not applicable   | Yes    | Create `farmall.config.mjs` and `agent-config/README.md` with create-only writes. |
| `farmall pull`  | `pull`           | Yes    | Run and apply a configured import pipeline.                                       |
| `farmall sync`  | `default`        | Yes    | Run and apply a configured artifact pipeline.                                     |
| `farmall lint`  | `default`        | No     | Run configured stages and fail when diagnostics contain an error.                 |
| `farmall check` | `default`        | No     | Print diagnostics, planned actions, and a summary.                                |
| `farmall diff`  | `default`        | No     | Print deterministic before and after content for non-noop actions.                |

## Options

| Option              | Commands                                | Behavior                                                                                                                                                                                                                                                                   |
| ------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--config <path>`   | `pull`, `sync`, `lint`, `check`, `diff` | Load an explicit config path relative to the current directory.                                                                                                                                                                                                            |
| `--pipeline <name>` | `pull`, `sync`, `lint`, `check`, `diff` | Select a named pipeline.                                                                                                                                                                                                                                                   |
| `--json`            | All commands                            | Print one structured JSON document. Byte bodies use `{ "encoding": "base64", "data": "..." }`. `diff --json` prints the plan; `sync --json` and `pull --json` print `{ "run": ..., "applied": ... }` after apply succeeds; other pipeline commands print the pipeline run. |

Text diffs render line-by-line content. Binary creates, updates, deletes, and conflicts render a stable marker containing the byte count and SHA-256 digest; Farmall never decodes binary data for terminal output.

## Exit behavior

`check` and `diff` exit with status 1 when the plan contains a create, update, delete, or conflict action. They exit successfully when every action is a no-op.

Lint failures use status 1. Config, plugin, and source errors use status 3. Conflict, plan, and apply errors use status 4.

Error-level diagnostics and plan conflicts block `sync` and `pull`. Warnings and informational diagnostics do not block apply.

`sync --json` and `pull --json` do not print a successful result before apply. Preparation or apply failures report through the normal error channel without a partial success document on standard output.
