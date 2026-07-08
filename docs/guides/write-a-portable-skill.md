# Write a Portable Skill

Write a `SKILL.md`, run `farmall lint`, and read the report to learn where your one physical file won't behave across agents. Fix it, or override the rule for a platform you don't care about.

> **WIP.** This page describes the design. `lint` isn't wired up yet.

## Start with a skill

```markdown
---
name: review-pr
description: Reviews code.
globs: "**/*.ts"
model: claude-opus-4-8
allowed-tools: [Read, Bash]
---

Read the diff and check each hunk against the house-style checklist...
```

This works on Claude Code, which is where it was written. Whether it works anywhere else is what [lint](../concepts/lint.md) answers.

## Run the lint

```bash
farmall lint skills
```

An illustrative report:

```
review-pr  (.farmall/skills/review-pr/SKILL.md)

  error  trigger-compat     description too vague to fire on codex, copilot
         "Reviews code." — no trigger cues; agents that match on
         description keywords won't select this skill.

  warn   frontmatter-drift  key `model` dropped by cursor, opencode, pi
         key `allowed-tools` dropped by codex, copilot, devin, opencode, pi
         claude-code honors both; every other agent silently ignores them.

  error  portability        `globs` requires a rules system, not a skill field
         skills fire by description, not glob — codex, pi have no way to
         scope this skill by path.

  2 errors, 1 warning
```

## Read the three rules

| Rule                | What it caught here                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `trigger-compat`    | The description is too thin to fire on agents that match on keywords.                                           |
| `frontmatter-drift` | `model` and `allowed-tools` are honored by Claude Code and dropped everywhere else.                             |
| `portability`       | `globs` belongs to [rules](./sync-instructions-and-rules.md), not skills — it can't scope a skill on any agent. |

See the [rule catalog](../reference/lint-rules.md) for what each inspects and its default severity.

## Fix the findings

**trigger-compat** — write a description that names the task and the trigger, not just the subject:

```yaml
description: Review a pull request diff for correctness and house-style issues. Use when the user asks for a code review, PR feedback, or "review this change".
```

**portability** — `globs` doesn't scope a skill. If you want path-scoped behavior, this belongs in a [rule](./sync-instructions-and-rules.md), not a skill. Drop the key:

```yaml
# removed: globs
```

**frontmatter-drift** — `model` and `allowed-tools` are real Claude Code keys but no other agent honors them. If you depend on them there, keep them and silence the warning where it doesn't apply.

Re-run:

```bash
farmall lint skills
```

```
review-pr  (.farmall/skills/review-pr/SKILL.md)

  warn   frontmatter-drift  key `model`, `allowed-tools` dropped by
         codex, copilot, cursor, devin, opencode, pi

  0 errors, 1 warning
```

Errors clear; the warning remains because the drift is real — those keys genuinely do nothing on six of seven agents.

## Override where a rule doesn't matter

You _want_ `model` and `allowed-tools` on Claude Code and accept they're inert elsewhere. Relax the rule for the platforms that drop them, in `farmall.config.ts`:

```ts
lint: {
  rules: { "frontmatter-drift": "warn" },
  overrides: [
    { platform: "codex", rules: { "frontmatter-drift": "off" } },
    { platform: "cursor", rules: { "frontmatter-drift": "off" } },
    { platform: "opencode", rules: { "frontmatter-drift": "off" } },
    { platform: "pi", rules: { "frontmatter-drift": "off" } },
  ],
}
```

The skill now lints clean. Wire `farmall lint` into CI to keep it that way — it exits non-zero on any `error`-severity finding.

## References

- [Lint](../concepts/lint.md)
- [Lint Rules Reference](../reference/lint-rules.md)
- [Sync Instructions and Rules](./sync-instructions-and-rules.md)
- [Configure the Support Matrix](./configure-the-support-matrix.md)
