# Platforms

`farmall` targets the agents people actually use — deeply, not a 40-agent sync race. Seven today, more
as the ecosystem grows.

> **WIP.** This page describes the design. Platform coverage is landing target by target.

## Supported agents

| Platform    | Config key    | Instructions                      | Rules                   |
| ----------- | ------------- | --------------------------------- | ----------------------- |
| Claude Code | `claude-code` | `CLAUDE.md`                       | `.claude/rules/*.md`    |
| Cursor      | `cursor`      | `AGENTS.md`                       | `.cursor/rules/*.mdc`   |
| Codex       | `codex`       | `AGENTS.md`                       | —                       |
| Copilot     | `copilot`     | `.github/copilot-instructions.md` | `.github/instructions/` |
| opencode    | `opencode`    | `AGENTS.md`                       | partial                 |
| Devin       | `devin`       | `AGENTS.md`                       | `.devin/rules/*.md`     |
| pi          | `pi`          | `AGENTS.md`                       | —                       |

For the full per-target breakdown — skills, subagents, and agent config paths — see the
[support matrix](../reference/support-matrix.md).

## Notes on specific agents

**Devin** is what Windsurf became. Cognition rebranded Windsurf Desktop to Devin Desktop in June 2026;
config moved from `.windsurf/` to `.devin/` (with `.windsurf/` kept as a fallback). `farmall` targets
the current `.devin/` paths.

**pi** ([earendil-works/pi](https://github.com/earendil-works/pi)) is a deliberately minimal terminal
agent — no MCP, no subagents, no plan mode by default. It reads `AGENTS.md` and `CLAUDE.md` and keeps
config under `.pi/`. Its minimalism means several targets are simply unsupported, which the
[portability lint](./lint.md) surfaces rather than papering over.

**Codex** and **Cursor** read `.agents/skills/` natively, so if you set [`source`](./configuration.md)
to `.agents`, those two need no skill symlinks at all.

## The gaps are the point

Every dash in the tables above is a place where an artifact you wrote won't behave on an agent. That's
not a defect to hide — it's exactly what [lint](./lint.md) reports, so you learn about it before your
teammate on a different agent does.

## References

- [Support Matrix](../reference/support-matrix.md)
- [Targets](./targets.md)
- [Lint](./lint.md)
- [Configuration](./configuration.md)
