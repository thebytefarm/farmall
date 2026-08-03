# Support Matrix

The canonical mapping of **target × platform** — where each artifact lands on each agent, and where it
can't land at all. This table is the ground truth [`lint`](../concepts/lint.md) reads.

> **WIP.** Paths reflect current agent conventions (July 2026) and are provisional — treat as
> authoritative-but-changeable. A dash means the target has no home on that agent; the
> [`portability`](./lint-rules.md#portability) rule flags it.

## Legend

- **path** — projected to this location by symlink.
- **—** — unsupported; `portability` flags it.
- **partial** — limited or convention-dependent support.

## Instructions

Authored as `AGENTS.md` in the working tree (root and nested), projected per agent at each level.

| Platform    | Location                          |
| ----------- | --------------------------------- |
| claude-code | `CLAUDE.md`                       |
| cursor      | `AGENTS.md`                       |
| codex       | `AGENTS.md`                       |
| copilot     | `.github/copilot-instructions.md` |
| opencode    | `AGENTS.md`                       |
| devin       | `AGENTS.md`                       |
| pi          | `AGENTS.md`                       |

## Rules

| Platform    | Location                                 |
| ----------- | ---------------------------------------- |
| claude-code | `.claude/rules/*.md`                     |
| cursor      | `.cursor/rules/*.mdc`                    |
| codex       | —                                        |
| copilot     | `.github/instructions/*.instructions.md` |
| opencode    | partial                                  |
| devin       | `.devin/rules/*.md`                      |
| pi          | —                                        |

## Skills

| Platform    | Location                 |
| ----------- | ------------------------ |
| claude-code | `.claude/skills/<name>/` |
| cursor      | `.cursor/skills/<name>/` |
| codex       | `.agents/skills/<name>/` |
| copilot     | `.github/skills/<name>/` |
| opencode    | partial                  |
| devin       | `.agents/skills/<name>/` |
| pi          | `.agents/skills/<name>/` |

Codex and Cursor read `.agents/skills/` natively; with `source: ".agents"` they need no extra links.

## Subagents

| Platform    | Location                    |
| ----------- | --------------------------- |
| claude-code | `.claude/agents/<name>.md`  |
| cursor      | —                           |
| codex       | partial                     |
| copilot     | —                           |
| opencode    | `.opencode/agent/<name>.md` |
| devin       | partial                     |
| pi          | —                           |

The still-experimental-everywhere target. Support and paths are the least settled here.

## Agents (agent-level config)

| Platform    | Location                |
| ----------- | ----------------------- |
| claude-code | `.claude/settings.json` |
| cursor      | `.cursor/`              |
| codex       | `.codex/config.toml`    |
| copilot     | —                       |
| opencode    | `opencode.json`         |
| devin       | `.devin/config.json`    |
| pi          | `.pi/settings.json`     |

## References

- [Platforms](../concepts/platforms.md)
- [Targets](../concepts/targets.md)
- [Lint Rules](./lint-rules.md)
