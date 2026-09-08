# Built-in plugins

## Sources

### `farmall:source`

Reads normalized artifacts and native direct outputs from the filesystem.

| Option     | Accepted value                                              | Default           |
| ---------- | ----------------------------------------------------------- | ----------------- |
| `root`     | Canonical relative path                                     | `agent-config`    |
| `patterns` | Strict partial artifact-kind object of relative glob arrays | Built-in patterns |
| `outputs`  | Canonical relative path or `false`                          | `outputs`         |

Built-in patterns are `AGENTS.md`, `rules/**/*.md`, `skills/**/SKILL.md`, and `subagents/**/*.md`. Omitted kind entries retain their built-in patterns. Use an empty array to disable a kind. Invalid entries and unknown keys fail validation.

### `farmall:platform-source`

Reads normalized artifacts from one built-in platform layout.

| Option     | Accepted value          | Default  |
| ---------- | ----------------------- | -------- |
| `platform` | A built-in platform ID  | Required |
| `root`     | Canonical relative path | `.`      |

The source skips artifact kinds marked unsupported in the [platform matrix](../concepts/platforms.md). It reads skill bundles but does not import native settings files.

## Lint

### `farmall:lint`

Checks skill artifacts only.

| Option      | Accepted value                           | Default                |
| ----------- | ---------------------------------------- | ---------------------- |
| `platforms` | Non-empty array of built-in platform IDs | All built-in platforms |

The plugin emits:

| Rule                             | Default severity | Condition                                                |
| -------------------------------- | ---------------- | -------------------------------------------------------- |
| `agent-skills/frontmatter`       | `error`          | A standard field violates its type or value constraint.  |
| `agent-skills/trigger-compat`    | `error`          | `description` exceeds 1024 characters.                   |
| `agent-skills/frontmatter-drift` | `warn`           | A selected platform does not recognize a metadata field. |

An absent `platforms` option checks every built-in platform. A skill name must be 1-64 characters, match `^[a-z0-9]+(-[a-z0-9]+)*$`, and equal the directory immediately containing `SKILL.md`, including below nested skill roots. `description` must be a non-empty string of at most 1024 characters. If present, `compatibility` must be a non-empty string of at most 500 characters, `metadata` must map strings to strings, and `license` and `allowed-tools` must be strings.

Drift checks use each platform's documented frontmatter behavior:

| Platform    | Recognized standard fields                                    | Recognized native fields                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | All six                                                       | `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell` |
| Cursor      | `name`, `description`, `metadata`                             | `paths`, `disable-model-invocation`, `icon`, `color`, and legacy `globs`                                                                                                                      |
| Codex       | All six                                                       | None in `SKILL.md`; Codex-specific metadata belongs in `agents/openai.yaml`                                                                                                                   |
| Copilot     | All six                                                       | `argument-hint`, `user-invocable`, `disable-model-invocation`                                                                                                                                 |
| OpenCode    | `name`, `description`, `license`, `compatibility`, `metadata` | None                                                                                                                                                                                          |
| Windsurf    | All six                                                       | None documented                                                                                                                                                                               |
| Devin       | `name`, `description`, `allowed-tools`                        | `argument-hint`, `model`, `subagent`, `agent`, `permissions`, `triggers`                                                                                                                      |
| pi          | All six                                                       | `disable-model-invocation`                                                                                                                                                                    |

The six standard fields are `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools`. Farmall treats standard fields as recognized where a platform claims Agent Skills compatibility and its documentation does not explicitly say otherwise. In particular, OpenCode documents that `allowed-tools` is ignored, while Cursor and Devin publish narrower field lists. Drift recognition does not filter output: every frontmatter field is preserved verbatim in emitted skill files.

Empty platform arrays, unknown platform IDs, malformed values, and unknown option keys fail validation.

## Outputs

### `farmall:filesystem`

Writes normalized artifacts back to a filesystem layout. Its default root is `agent-config`.

| Kind         | Default path           |
| ------------ | ---------------------- |
| Instructions | `AGENTS.md`            |
| Rules        | `rules/{name}.md`      |
| Skills       | `skills/{name}/{file}` |
| Subagents    | `subagents/{name}.md`  |

### Platform outputs

Each platform in the [platform matrix](../concepts/platforms.md) has an output plugin named `farmall:<platform>`.

All built-in outputs accept the same options:

| Option        | Accepted value                                            | Default                                          |
| ------------- | --------------------------------------------------------- | ------------------------------------------------ |
| `output`      | Safe output identifier                                    | Plugin platform ID, or `filesystem`              |
| `root`        | Canonical relative path                                   | `.` for platforms, `agent-config` for filesystem |
| `writePolicy` | `managed` or `create-only`                                | `managed`                                        |
| `paths`       | Artifact-kind keys mapped to a template string or `false` | Platform defaults                                |

Path templates support `{name}`, `{path}`, and `{file}`. A `false` mapping disables the artifact kind and produces `farmall/unsupported-artifact` warnings for matching artifacts.

Every built-in options object is strict. Unknown keys, wrong types, absolute paths, backslashes, `..` segments, non-canonical aliases such as `a//b`, unsafe output names, and invalid write policies return a plugin `CoreError`. Defaults apply only when an option or artifact-kind override is absent. Built-in outputs repeat validation when run, so malformed runtime options fail before Farmall can interpret an empty desired set as a stale-output claim.

The `output` name also selects matching `DirectOutput` emissions. Setting `name` on a plugin use supplies this option automatically:

```js
{
  use: "farmall:codex",
  name: "work-codex",
  options: {
    root: "generated/work",
    paths: { rules: "rules/{name}.md" },
    writePolicy: "create-only",
  },
}
```
