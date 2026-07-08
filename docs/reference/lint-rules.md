# Lint Rules

The rule catalog. Each rule inspects one way a single source file can misbehave once it's linked into
multiple agents. Set severities in [`lint.rules`](../concepts/configuration.md#lint-config).

> **WIP.** This page describes the design. `lint` isn't wired up yet — rule IDs and defaults may change.

## Severities

| Severity | Reported | Fails `lint` (exit 1) |
| -------- | -------- | --------------------- |
| `error`  | yes      | yes                   |
| `warn`   | yes      | no                    |
| `off`    | no       | no                    |

## `trigger-compat`

**Default: `error`.** Checks whether a skill's `description` will actually cause the skill to fire on
each configured agent. Agents differ in how they match a description to a task — length limits,
keyword sensitivity, and whether the trigger is model-decided or glob-scoped. A description tuned for
one agent's matcher can go dark on another.

Flags: descriptions that exceed an agent's limit, rely on a trigger mechanism an agent doesn't have,
or are too vague to fire anywhere.

## `frontmatter-drift`

**Default: `warn`.** Cross-references each artifact's frontmatter keys against what every target agent
honors. Because [sync](../concepts/sync.md) links one physical file everywhere, all agents read the
same frontmatter — this rule tells you which keys each one will honor and which it will silently drop.

Flags: keys an agent ignores that you depend on, and keys that cause an agent to reject the file.

## `portability`

**Default: `error`.** Checks whether an artifact can run on a target agent _at all_. Some targets —
skills on agents without a skills system, subagents on agents without subagent support — have no home
on certain platforms.

Flags: any target/platform pair where the artifact simply cannot be projected. See the
[support matrix](./support-matrix.md) for the ground truth this rule reads.

## Overrides

Relax a rule for one platform:

```ts
lint: {
  rules: { "frontmatter-drift": "warn" },
  overrides: [
    { platform: "codex", rules: { "frontmatter-drift": "off" } },
  ],
}
```

## References

- [Lint](../concepts/lint.md)
- [Support Matrix](./support-matrix.md)
- [Config Reference](./config.md)
- [Write a Portable Skill](../guides/write-a-portable-skill.md)
