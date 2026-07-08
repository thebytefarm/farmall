# Targets

`farmall` syncs five kinds of artifact. Each is a **target**: a source subdirectory, a projection rule
per agent, and a set of lint checks.

> **WIP.** This page describes the design. The commands aren't wired up yet.

| Target         | Source                       | Nature                                  |
| -------------- | ---------------------------- | --------------------------------------- |
| `instructions` | `.farmall/AGENTS.md`         | one portable memory file, always-on     |
| `rules`        | `.farmall/rules/*.md`        | many scoped files, conditionally loaded |
| `skills`       | `.farmall/skills/*/SKILL.md` | reusable capability bundles             |
| `subagents`    | `.farmall/subagents/*.md`    | named delegate agents                   |
| `agents`       | `.farmall/agents/*`          | agent-level config / model selection    |

## Instructions vs rules

The distinction people miss: **instructions and rules are not the same thing**, and nearly every agent
now supports both — separately.

**Instructions** are the always-on project memory. One document, read at the start of every session,
describing how to work in this repo: commands, conventions, boundaries. The portable format is
`AGENTS.md`; Claude Code calls its copy `CLAUDE.md`; Copilot calls it
`.github/copilot-instructions.md`. Same content, different filename.

**Rules** are scoped, conditionally-loaded files with frontmatter that decides _when_ they apply —
glob-attached to certain paths, model-requested on demand, or manually invoked. Cursor's
`.cursor/rules/*.mdc`, Claude Code's `.claude/rules/*.md` (with `paths` frontmatter), and Devin's
`.devin/rules/*.md` are all this shape.

|                        | instructions         | rules                                        |
| ---------------------- | -------------------- | -------------------------------------------- |
| **Cardinality**        | one file             | many files                                   |
| **Activation**         | always loaded        | frontmatter/glob-scoped                      |
| **Canonical format**   | `AGENTS.md`          | agent-specific frontmatter                   |
| **Ported by symlink?** | yes — plain markdown | yes, when the runtime tolerates foreign keys |

Rules are where the [portability lint](./lint.md) earns its keep: a rule authored for Cursor's `.mdc`
frontmatter may load differently — or not at all — on an agent that expects a different trigger field.

## Skills

A skill is a directory with a `SKILL.md` (name + description + instructions) and optional
`scripts/`, `references/`, and `assets/`. This is the [Agent Skills open standard](https://agentskills.io).
`farmall` keeps one physical skill directory and symlinks it into each agent's skills location, so the
single `SKILL.md` is what every agent loads.

## Subagents

Named delegate agents a primary agent can hand work to. Support is uneven across the ecosystem — this
is the still-experimental-everywhere target, so `farmall` syncs it conservatively and leans on
[portability lint](./lint.md) to flag agents that can't run a given subagent at all.

## Agents

Agent-level configuration — model selection, permissions, tool defaults — written to each tool's own
config location. The most agent-specific target, and the one most often left `false` in config.

## References

- [Define Once](./define-once.md)
- [Sync](./sync.md)
- [Lint](./lint.md)
- [Support Matrix](../reference/support-matrix.md)
