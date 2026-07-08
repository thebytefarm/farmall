# Config Reference

The full `farmall.config.ts` type. Authored with `defineConfig` for type safety; `.js`, `.yaml`, and
`.json` accept the same shape.

> **WIP.** This page describes the design. The config loader isn't wired up yet.

## `defineConfig(config)`

```ts
import { defineConfig } from "farmall";

export default defineConfig({/* ... */});
```

Returns the config unchanged; exists for editor types and validation.

## `FarmallConfig`

```ts
interface FarmallConfig {
  source?: string; // default ".farmall"
  platforms: Platform[];
  sync?: Partial<Record<Target, SyncSpec>>;
  lint?: LintConfig;
}
```

| Field       | Type                                | Default     | Description                    |
| ----------- | ----------------------------------- | ----------- | ------------------------------ |
| `source`    | `string`                            | `.farmall`  | Source-of-truth directory.     |
| `platforms` | `Platform[]`                        | —           | Agents to sync to (required).  |
| `sync`      | `Partial<Record<Target, SyncSpec>>` | all enabled | Per-target sync behavior.      |
| `lint`      | `LintConfig`                        | defaults    | Rule severities and overrides. |

## `Platform`

```ts
type Platform = "claude-code" | "cursor" | "codex" | "copilot" | "opencode" | "devin" | "pi";
```

## `Target`

```ts
type Target = "instructions" | "rules" | "skills" | "subagents" | "agents";
```

## `SyncSpec`

Each `sync` entry is either a boolean or a `SyncSpecObject`.

```ts
type SyncSpec = boolean | SyncSpecObject;

interface SyncSpecObject {
  include?: string; // glob of source files to sync
  exclude?: string; // glob of source files to skip
  format?: string; // canonical format (e.g. "agents-md")
  out?: string; // override default output location
}
```

`true` syncs the target with defaults; `false` disables it. `instructions.format` defaults to
`"agents-md"`.

## `LintConfig`

```ts
interface LintConfig {
  rules?: Partial<Record<RuleId, Severity>>;
  overrides?: LintOverride[];
}

interface LintOverride {
  platform: Platform;
  rules: Partial<Record<RuleId, Severity>>;
}

type RuleId = "trigger-compat" | "frontmatter-drift" | "portability";
type Severity = "error" | "warn" | "off";
```

See the [rule catalog](./lint-rules.md) for default severities and what each rule inspects.

## Full example

```ts
import { defineConfig } from "farmall";

export default defineConfig({
  source: ".farmall",
  platforms: ["claude-code", "cursor", "codex", "copilot", "opencode", "devin", "pi"],
  sync: {
    instructions: { format: "agents-md" },
    rules: true,
    skills: { include: "skills/**", exclude: "**/*.wip/**" },
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

## References

- [Configuration](../concepts/configuration.md)
- [Lint Rules](./lint-rules.md)
- [CLI Reference](./cli.md)
