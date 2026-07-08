# Lint

Everyone can copy files. Nobody checks whether the copy _works_. `farmall lint` is the reason this
tool exists.

> **WIP.** This page describes the design. `lint` isn't wired up yet.

## The gap it fills

[Sync](./sync.md) gets your config _there_ — one physical file, symlinked into every agent. But a
single file read by seven runtimes doesn't behave identically. A description that fires on Claude Code
may never trigger on Codex. A frontmatter key one agent honors, another silently drops. A subagent
written for one tool may not run on another at all.

Lint reads your source of truth, cross-references the [support matrix](../reference/support-matrix.md)
for your configured [platforms](./platforms.md), and reports where behavior will diverge.

## The rules

| Rule                | Checks                                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| `trigger-compat`    | Will a skill's description fire on each agent, or only the one you wrote for? |
| `frontmatter-drift` | Which frontmatter fields does each agent honor, and which get dropped?        |
| `portability`       | Will a subagent/skill run on a target agent at all?                           |

Each rule has a severity — `error`, `warn`, or `off` — set in
[`lint.rules`](./configuration.md#lint-config). See the [rule catalog](../reference/lint-rules.md)
for what each one inspects and its default severity.

## Per-platform overrides

Not every rule matters for every agent. Relax or tighten a rule for one platform with
`lint.overrides`:

```ts
lint: {
  rules: { "frontmatter-drift": "warn" },
  overrides: [
    { platform: "codex", rules: { "frontmatter-drift": "off" } },
  ],
}
```

## Severity and exit codes

| Severity | Reported | Fails `lint`? |
| -------- | -------- | ------------- |
| `error`  | yes      | yes (exit 1)  |
| `warn`   | yes      | no            |
| `off`    | no       | no            |

Run it in CI to keep a portable config portable:

```bash
farmall lint                 # lint every enabled target across configured platforms
farmall lint skills          # lint a single target
```

## Sync gets it there. Lint tells you whether it will behave.

That one line is the whole product. Sync is table stakes; lint is the differentiator.

## References

- [Sync](./sync.md)
- [Lint Rules Reference](../reference/lint-rules.md)
- [Write a Portable Skill](../guides/write-a-portable-skill.md)
- [Platforms](./platforms.md)
