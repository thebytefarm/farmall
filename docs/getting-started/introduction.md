# Introduction

Farmall compiles agent configuration through named pipelines. A pipeline reads normalized artifacts or an existing platform layout, runs optional transforms and lint checks, then asks output plugins for desired files.

The core compares those desired files with the working tree and `.farmall-state.json`. Only `sync`, `pull`, and `init` apply a plan. `check` and `diff` stop after planning.

## What Farmall manages

Farmall recognizes four normalized artifact kinds:

| Kind         | Default source                                                           |
| ------------ | ------------------------------------------------------------------------ |
| Instructions | `agent-config/AGENTS.md`                                                 |
| Rules        | `agent-config/rules/**/*.md`                                             |
| Skills       | `agent-config/skills/**/SKILL.md` and every file in each skill directory |
| Subagents    | `agent-config/subagents/**/*.md`                                         |

Outputs are platform-specific. Claude Code supports all four built-in mappings. Other platforms omit one or more mappings. Farmall emits `farmall/unsupported-artifact` warnings for those gaps and leaves the unsupported files unwritten.

## Native files stay native

Some files do not have a portable representation. Put them under the named output tree:

```text
agent-config/
  outputs/
    claude-code/
      .claude/settings.json
    codex/
      .codex/config.toml
```

`farmall:source` emits these as `DirectOutput` values. An output plugin consumes only direct outputs whose name matches its `output` option. The file path and content pass through unchanged beneath the output root.

Farmall does not convert Claude settings into Codex settings or infer a common settings schema.

## Why the tractor name

International Harvester introduced the Farmall tractor as one machine for the varied work on a farm. This project uses the same practical idea for agent configuration while keeping each tool's actual file conventions visible.
