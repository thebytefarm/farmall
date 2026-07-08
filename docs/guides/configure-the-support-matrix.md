# Configure the Support Matrix

Walk through a realistic `farmall.config.ts`: which platforms you sync to, how each target syncs, and which lint rules apply where.

> **WIP.** This page describes the design. The config loader isn't wired up yet.

## The whole config

```ts
// farmall.config.ts
import { defineConfig } from "farmall";

export default defineConfig({
  source: ".farmall",
  platforms: ["claude-code", "cursor", "codex", "copilot"],
  sync: {
    instructions: { format: "agents-md" },
    rules: true,
    skills: { include: "skills/**", exclude: "**/*.wip/**" },
    subagents: { include: "subagents/**" },
    agents: false,
  },
  lint: {
    rules: {
      "trigger-compat": "error",
      "frontmatter-drift": "warn",
      portability: "error",
    },
    overrides: [
      { platform: "codex", rules: { "frontmatter-drift": "off" } },
      { platform: "copilot", rules: { portability: "warn" } },
    ],
  },
});
```

## Select platforms

`platforms` is the list of agents you actually use — sync and lint both operate over exactly this set. Adding a platform here is what starts projecting to it and linting against it:

```ts
platforms: ["claude-code", "cursor", "codex", "copilot"],
```

Leave out the agents you don't run. The [seven supported platforms](../concepts/platforms.md) are `claude-code`, `cursor`, `codex`, `copilot`, `opencode`, `devin`, `pi`.

## Per-target sync specs

Each key of `sync` is a boolean or an object. `true` syncs with defaults, `false` disables the target, an object configures it:

| Setting                                 | Effect                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `instructions: { format: "agents-md" }` | Author instructions as `AGENTS.md` (the default, always).                         |
| `rules: true`                           | Sync every rule under `.farmall/rules/` to agents that support rules.             |
| `skills: { include, exclude }`          | Sync matching skills; skip work-in-progress ones.                                 |
| `subagents: { include }`                | Sync only the subagents matched by the glob.                                      |
| `agents: false`                         | Don't sync agent-level config — the most agent-specific target, usually left off. |

### include / exclude globs

`include` and `exclude` are globs relative to `source`. They pick which source files a target syncs:

```ts
skills: { include: "skills/**", exclude: "**/*.wip/**" },
```

This syncs every skill except directories tagged `.wip`. Use `exclude` to keep drafts in the source tree without projecting them to any agent.

### out

Override the default output location for a target with `out` when an agent expects a non-standard path in your repo. Most configs never need it.

## Lint rule severities

`lint.rules` sets the severity of each [rule](../reference/lint-rules.md) — `error`, `warn`, or `off`:

```ts
rules: {
  "trigger-compat": "error",     // a skill that won't fire is a bug
  "frontmatter-drift": "warn",   // dropped keys are worth knowing, not blocking
  portability: "error",          // an artifact with no home should fail CI
},
```

Only `error` fails `farmall lint` (exit 1). `warn` reports without failing; `off` suppresses.

## Per-platform overrides

`lint.overrides` narrows or relaxes a rule for one platform. Two realistic cases from the config above:

```ts
overrides: [
  { platform: "codex", rules: { "frontmatter-drift": "off" } },
  { platform: "copilot", rules: { portability: "warn" } },
],
```

- **codex / frontmatter-drift off** — Codex drops most frontmatter keys by design; the drift warning against it is noise, so silence it there while keeping it a warning everywhere else.
- **copilot / portability warn** — you know some subagents have no Copilot home and you're fine shipping anyway; demote the error to a warning for Copilot only, so CI still blocks on the other platforms.

An override only changes the named rules for the named platform. Everything else falls back to `lint.rules`.

## Verify the config

```bash
farmall check        # does the config resolve, and would sync converge?
farmall lint         # apply these severities across configured platforms
```

## References

- [Configuration](../concepts/configuration.md)
- [Config Reference](../reference/config.md)
- [Support Matrix](../reference/support-matrix.md)
- [Lint Rules Reference](../reference/lint-rules.md)
