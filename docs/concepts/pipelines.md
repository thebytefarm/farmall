# Pipelines

A Farmall config contains one or more named pipelines. Commands select a pipeline with `--pipeline`. `sync`, `lint`, `check`, and `diff` default to `default`; `pull` defaults to `pull`.

```js
export default {
  state: ".farmall-state.json",
  pipelines: {
    default: {
      sources: [{ use: "farmall:source", options: { root: "agent-config" } }],
      transforms: [],
      lint: [{ use: "farmall:lint" }],
      outputs: [{ use: "farmall:claude-code" }, { use: "farmall:codex" }],
    },
    pull: {
      sources: [{ use: "farmall:platform-source", options: { platform: "claude-code" } }],
      outputs: [{ use: "farmall:filesystem", options: { writePolicy: "create-only" } }],
    },
  },
  severity: {
    "agent-skills/frontmatter-drift": "warn",
    "farmall/unsupported-artifact": "off",
  },
};
```

## Stage order

| Stage        | Required          | Contract                                                             |
| ------------ | ----------------- | -------------------------------------------------------------------- |
| `sources`    | Yes, at least one | Append `Artifact` or `DirectOutput` emissions.                       |
| `transforms` | No                | Replace the current emissions in declaration order.                  |
| `outputs`    | Yes, at least one | Return desired paths, content, ownership metadata, and write policy. |
| `lint`       | No                | Return diagnostics for transformed emissions.                        |

Output stages run before lint stages, but no stage writes. A later planning or lint failure therefore leaves the working tree unchanged.

Every plugin use has a `use` ID and optional `options`. The optional `name` assigns a unique plugin instance name within the pipeline and is passed to `run` as the `output` option. Named direct outputs use this value for routing.

## Severity overrides

Top-level `severity` entries apply by diagnostic rule after every stage completes:

| Value   | Effect                                         |
| ------- | ---------------------------------------------- |
| `error` | Blocks `sync` and `pull`; makes `lint` fail.   |
| `warn`  | Reports the diagnostic without blocking apply. |
| `info`  | Reports informational output.                  |
| `off`   | Removes the diagnostic.                        |

Overrides are global to the config. Platform-specific lint scope belongs in the lint plugin options, for example `{ platforms: ["claude-code", "codex"] }`. The lint stage validates standard skill metadata without changing emitted artifacts or output files.
