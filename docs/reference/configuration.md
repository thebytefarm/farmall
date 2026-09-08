# Configuration reference

Farmall accepts these discovered filenames, in priority-independent conflict detection:

```text
farmall.config.ts
farmall.config.js
farmall.config.mjs
farmall.config.json
farmall.config.jsonc
farmall.config.yaml
farmall.config.yml
```

Without `--config`, Farmall searches the current directory, then each parent directory. If a directory contains more than one supported config filename, loading fails. The directory containing the selected config becomes the project root for source reads, output paths, plugin resolution, and state.

TypeScript, JavaScript, and MJS configs use their default export and are freshly evaluated on every load. JSON, JSONC, and YAML files use the same data shape. JSONC accepts line and block comments plus trailing commas; URLs and comment-like string content are preserved. Syntax and filesystem errors are returned as config errors.

## Top-level fields

| Field       | Type                             | Default               | Purpose                                                   |
| ----------- | -------------------------------- | --------------------- | --------------------------------------------------------- |
| `state`     | `string`                         | `.farmall-state.json` | Ownership manifest path relative to the config root.      |
| `plugins`   | `string[]`                       | `[]`                  | Relative, absolute, or package module specifiers to load. |
| `pipelines` | `Record<string, PipelineConfig>` | Required              | Named pipeline definitions.                               |
| `severity`  | `Record<string, Severity>`       | `{}`                  | Rule-level diagnostic overrides.                          |

Unknown fields are rejected.

`Severity` is `"error" | "warn" | "info" | "off"`.

## Pipeline fields

| Field        | Type          | Required                |
| ------------ | ------------- | ----------------------- |
| `sources`    | `PluginUse[]` | Yes, at least one entry |
| `transforms` | `PluginUse[]` | No                      |
| `lint`       | `PluginUse[]` | No                      |
| `outputs`    | `PluginUse[]` | Yes, at least one entry |

Each plugin use has this shape:

```ts
interface PluginUse {
  readonly use: string;
  readonly name?: string;
  readonly options?: Readonly<Record<string, unknown>>;
}
```

`name` values must be unique within a pipeline. The runtime merges `name` into the plugin's run options as `output`; built-in outputs validate the merged runtime options before producing desired files.

## Complete example

```js
export default {
  state: ".farmall-state.json",
  plugins: ["./plugins/normalize.mjs"],
  pipelines: {
    default: {
      sources: [
        {
          use: "farmall:source",
          options: { root: "agent-config", outputs: "outputs" },
        },
      ],
      transforms: [{ use: "acme:normalize" }],
      lint: [
        {
          use: "farmall:lint",
          options: { platforms: ["claude-code", "codex"] },
        },
      ],
      outputs: [
        { use: "farmall:claude-code" },
        {
          use: "farmall:codex",
          name: "work-codex",
          options: { root: "generated", writePolicy: "managed" },
        },
      ],
    },
  },
  severity: {
    "agent-skills/frontmatter-drift": "info",
  },
};
```

`defineConfig` and the config interfaces are exported from `@farmall/core`. The `farmall` package exposes the executable, not a re-export of the core TypeScript API.
