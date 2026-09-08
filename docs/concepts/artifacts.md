# Artifact layout

The default `farmall:source` root is `agent-config`. Its default patterns produce a small normalized layout:

| Kind         | Pattern              | Naming behavior                                                           |
| ------------ | -------------------- | ------------------------------------------------------------------------- |
| Instructions | `AGENTS.md`          | File basename without extension.                                          |
| Rules        | `rules/**/*.md`      | Path below `rules/`, without extension.                                   |
| Skills       | `skills/**/SKILL.md` | Safe frontmatter `name` when present, otherwise the containing directory. |
| Subagents    | `subagents/**/*.md`  | Path below `subagents/`, without extension.                               |

Markdown and MDC files with YAML frontmatter expose that frontmatter as artifact metadata. Primary artifact content is UTF-8 text so frontmatter parsing and linting remain text-based; invalid UTF-8 or invalid frontmatter is a source error. A supplied skill `name` must be a canonical safe relative identifier; Farmall rejects unsafe names instead of sanitizing them or falling back. Skill outputs preserve all frontmatter, including the optional standard `license`, `compatibility`, `metadata`, and `allowed-tools` fields. Skill artifacts recursively bundle every file under the skill directory, including hidden files, and preserve each relative path, exact bytes, and POSIX permission mode.

Metadata is recursive JSON: finite numbers, strings, booleans, null, arrays, and plain objects. Farmall preserves valid nested values and rejects unsupported YAML/runtime values rather than carrying values that cannot be represented safely in CLI JSON output.

You can replace the patterns per kind:

```js
{
  use: "farmall:source",
  options: {
    root: "config/agents",
    patterns: {
      instructions: ["instructions/*.md"],
      rules: ["policies/**/*.mdc"],
      skills: ["skills/**/SKILL.md"],
      subagents: [],
    },
  },
}
```

When `patterns` is an object, omitted kind entries retain their defaults. Empty arrays explicitly select no files. Invalid entries and unknown keys fail plugin validation.

## Native direct outputs

The same source plugin scans `agent-config/outputs` by default:

```text
agent-config/outputs/<output>/<destination path>
```

For example, `agent-config/outputs/claude-code/.claude/settings.json` becomes a `DirectOutput` named `claude-code` with `.claude/settings.json` as its destination path. The `farmall:claude-code` output consumes it because its default output name is `claude-code`.

Set `outputs` to a different directory name or `false`:

```js
{ use: "farmall:source", options: { outputs: "native" } }
{ use: "farmall:source", options: { outputs: false } }
```

Direct outputs preserve exact bytes and POSIX permission mode, including executable files, invalid UTF-8, and NUL bytes. They are not parsed into artifacts or converted to another platform.

Both `<output>` and `<destination path>` are validated before emission. Output names are single safe identifiers. Destination paths must already be canonical and relative; absolute paths, backslashes, empty paths, `..` segments, and aliases that require normalization are rejected.
