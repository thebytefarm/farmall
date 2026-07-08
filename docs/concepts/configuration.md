# Configuration

`farmall.config.ts` declares **what's supported and how it syncs**. It's the single grammar `farmall`
reads — type-safe via `defineConfig`.

> **WIP.** This page describes the design. The config loader isn't wired up yet.

## The shape

```ts
// farmall.config.ts
import { defineConfig } from "farmall";

export default defineConfig({
  source: ".farmall",
  platforms: ["claude-code", "cursor", "codex"],
  sync: {
    instructions: { format: "agents-md" },
    rules: true,
    skills: { include: "skills/**" },
    subagents: true,
    agents: false,
  },
  lint: {
    rules: {
      "trigger-compat": "error",
      "frontmatter-drift": "warn",
      portability: "error",
    },
    overrides: [{ platform: "codex", rules: { "frontmatter-drift": "off" } }],
  },
});
```

`.js`, `.yaml`, and `.json` take the same shape for anyone who'd rather skip a TS file.

## Fields

| Field       | Type                       | Default       | Purpose                                     |
| ----------- | -------------------------- | ------------- | ------------------------------------------- |
| `source`    | `string`                   | `.farmall`    | The source-of-truth directory.              |
| `platforms` | `Platform[]`               | —             | Which agents to sync to.                    |
| `sync`      | `Record<Target, SyncSpec>` | all `true`    | Which targets sync, and how.                |
| `lint`      | `{ rules, overrides? }`    | rule defaults | Rule severities and per-platform overrides. |

See the [config reference](../reference/config.md) for the full type.

## Per-target sync spec

Each key of `sync` is either a boolean or an object:

```ts
sync: {
  skills: true,                              // sync with defaults
  rules: false,                              // don't sync this target
  instructions: { format: "agents-md" },     // canonical instruction format
  subagents: { include: "subagents/**", exclude: "**/*.wip.md" },
}
```

| Option    | Type     | Purpose                                               |
| --------- | -------- | ----------------------------------------------------- |
| `include` | `string` | Glob of source files to sync.                         |
| `exclude` | `string` | Glob of source files to skip.                         |
| `format`  | `string` | Canonical format (e.g. `agents-md` for instructions). |
| `out`     | `string` | Override the default output location.                 |

## Lint config

`lint.rules` sets a severity per rule; `lint.overrides` narrows or relaxes rules for a specific
platform. See [Lint](./lint.md) and the [rule catalog](../reference/lint-rules.md).

```ts
lint: {
  rules: { "trigger-compat": "error", "frontmatter-drift": "warn", portability: "error" },
  overrides: [
    { platform: "codex", rules: { "frontmatter-drift": "off" } },
  ],
}
```

## References

- [Config Reference](../reference/config.md)
- [Lint](./lint.md)
- [Platforms](./platforms.md)
- [Configure the Support Matrix](../guides/configure-the-support-matrix.md)
