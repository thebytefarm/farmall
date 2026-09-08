# CLI

Farmall's CLI manages one source of truth for AI coding-agent configuration.

## Command structure

`packages/cli/src/index.ts` starts Maltty with Farmall's metadata and command map. `packages/cli/src/commands/` contains one file per command, with `commands/index.ts` as the only registry. `commands/project-command.ts` owns configured-project command options and orchestration. `output.ts` owns stable text and JSON formatting, while `exit-status.ts` owns core-error status mapping and status predicates.

```text
farmall <command> [options]
```

Maltty supplies global help and version handling. Project commands share these options:

| Option              | Behavior                                         |
| ------------------- | ------------------------------------------------ |
| `--config <path>`   | Use an explicit Farmall config                   |
| `--pipeline <name>` | Select a named pipeline, defaulting to `default` |
| `--json`            | Print structured JSON                            |

`pull` changes the default pipeline to `pull`. `init` accepts only `--json`.

## Commands

| Command         | Behavior                                                                      |
| --------------- | ----------------------------------------------------------------------------- |
| `farmall init`  | Create `farmall.config.mjs` and `agent-config/README.md` as create-only files |
| `farmall pull`  | Run and apply the configured `pull` pipeline                                  |
| `farmall sync`  | Run and apply the selected pipeline                                           |
| `farmall lint`  | Print the pipeline run and fail when it contains error diagnostics            |
| `farmall check` | Print the pipeline run without writing and report drift through status        |
| `farmall diff`  | Render deterministic file differences without writing                         |

In text mode, `sync` and `pull` print the computed run before applying its plan, then print the apply summary. In JSON mode, they apply first and print one document containing `{ run, applied }` only after apply succeeds. Both reject lint errors and conflicts before writing. `check` and `diff` use the same plan but never apply it.

## Status codes

| Code | Meaning                                        |
| ---- | ---------------------------------------------- |
| `0`  | Command completed, or preview found no changes |
| `1`  | Lint failed, or `check`/`diff` found changes   |
| `3`  | Config, plugin, or source failure              |
| `4`  | Conflict, planning, or apply failure           |

## Artifact kinds

| Kind           | Contents                                                    |
| -------------- | ----------------------------------------------------------- |
| `instructions` | Portable project memory, authored as `AGENTS.md` by default |
| `rules`        | Scoped rules with platform-specific activation metadata     |
| `skills`       | Reusable `SKILL.md` packages                                |
| `subagents`    | Subagent definitions                                        |

Platform-native files that do not map to an artifact kind can pass through a named direct output.

## Implementation rules

- Keep argument parsing, display, and exit behavior in `packages/cli`.
- Put filesystem planning, sync, lint, and platform behavior in `packages/core`.
- Return structured results from core and render them at the CLI boundary.
- Define commands with Maltty's `command()` and register them in the exported command map.
- Keep each command in `commands/<command>.ts`; put shared configured-project flow in `commands/project-command.ts`.
- Keep output formatting in `output.ts` and exit policy in `exit-status.ts`.
- Reuse the core pipeline and central plan instead of implementing command-specific filesystem writes.
- Cover command behavior with CLI integration tests that run the built executable in temporary repositories.

## Adding commands

Follow [Add a CLI command](../guides/adding-a-cli-command.md). Update this document and user-facing docs when the command surface changes.

## References

- [Architecture](./architecture.md)
- [Project overview](../../docs/concepts/overview.md)
