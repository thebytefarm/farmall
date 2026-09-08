# Platform matrix

The built-in matrix maps normalized artifacts to paths. `Unsupported` means the output plugin emits a `farmall/unsupported-artifact` warning and does not write that artifact.

| Platform    | Instructions                      | Rules                                         | Skills                           | Subagents                        |
| ----------- | --------------------------------- | --------------------------------------------- | -------------------------------- | -------------------------------- |
| Claude Code | `CLAUDE.md`                       | `.claude/rules/{name}.md`                     | `.claude/skills/{name}/{file}`   | `.claude/agents/{name}.md`       |
| Cursor      | `AGENTS.md`                       | `.cursor/rules/{name}.mdc`                    | `.cursor/skills/{name}/{file}`   | `.cursor/agents/{name}.md`       |
| Codex       | `AGENTS.md`                       | Unsupported                                   | `.agents/skills/{name}/{file}`   | Unsupported                      |
| Copilot     | `.github/copilot-instructions.md` | `.github/instructions/{name}.instructions.md` | `.github/skills/{name}/{file}`   | `.github/agents/{name}.agent.md` |
| opencode    | `AGENTS.md`                       | Unsupported                                   | `.opencode/skills/{name}/{file}` | `.opencode/agents/{name}.md`     |
| Windsurf    | `.windsurf/rules/farmall.md`      | `.windsurf/rules/{name}.md`                   | `.windsurf/skills/{name}/{file}` | Unsupported                      |
| Devin       | `AGENTS.md`                       | `.devin/rules/{name}.md`                      | `.agents/skills/{name}/{file}`   | Unsupported                      |
| pi          | `AGENTS.md`                       | Unsupported                                   | `.agents/skills/{name}/{file}`   | Unsupported                      |

Platform output plugin IDs are `farmall:claude-code`, `farmall:cursor`, `farmall:codex`, `farmall:copilot`, `farmall:opencode`, `farmall:windsurf`, `farmall:devin`, and `farmall:pi`.

These are file mappings, not a claim that platform behavior is equivalent. OpenCode loads `AGENTS.md`, project agents, and project skills automatically. Arbitrary modular instructions require `opencode.json` `instructions`, so standalone normalized rules are unsupported.

Platform imports use the same matrix in reverse for normalized artifact kinds. They recursively discover nested skills and preserve nested rule, skill, and subagent names, so same-basename artifacts in different directories do not collide. Native settings and platform-specific files outside the matrix are not imported as generic artifacts.

## Skill frontmatter recognized by lint

Farmall preserves all skill frontmatter in every output. Recognition only controls `agent-skills/frontmatter-drift` diagnostics, and differs by platform:

| Platform    | Standard fields                                               | Native fields                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | All                                                           | `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell` |
| Cursor      | `name`, `description`, `metadata`                             | `paths`, `disable-model-invocation`, `icon`, `color`, legacy `globs`                                                                                                                          |
| Codex       | All                                                           | None in `SKILL.md`                                                                                                                                                                            |
| Copilot     | All                                                           | `argument-hint`, `user-invocable`, `disable-model-invocation`                                                                                                                                 |
| OpenCode    | `name`, `description`, `license`, `compatibility`, `metadata` | None                                                                                                                                                                                          |
| Windsurf    | All                                                           | None documented                                                                                                                                                                               |
| Devin       | `name`, `description`, `allowed-tools`                        | `argument-hint`, `model`, `subagent`, `agent`, `permissions`, `triggers`                                                                                                                      |
| pi          | All                                                           | `disable-model-invocation`                                                                                                                                                                    |

The standard fields are `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools`. “All” is used when platform documentation claims Agent Skills compatibility without explicitly excluding a standard field. OpenCode explicitly ignores `allowed-tools`; Cursor and Devin document narrower lists.

Names must be 1-64 lowercase alphanumeric characters with single-hyphen separators and must match the directory containing `SKILL.md`. Descriptions must be non-empty and at most 1024 characters. If present, compatibility must be non-empty and at most 500 characters, metadata must map strings to strings, and license and allowed-tools must be strings.

Use native direct outputs for platform files outside this matrix. Farmall does not synthesize settings conversions.
