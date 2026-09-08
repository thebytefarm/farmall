# Vision

Agent configuration should be ordinary project input with explicit compilation rules. Farmall reads shared artifacts, checks the assumptions that can be checked, and writes only the platform mappings a pipeline requests.

## Product boundaries

- Preserve normalized instructions, rules, skills, and subagents without pretending every platform supports every kind.
- Preserve platform-native files byte for byte through named direct outputs instead of converting unrelated settings formats.
- Keep all writes in the core planner and apply engine. Plugins describe emissions, diagnostics, and desired files.
- Refuse to replace files that Farmall does not own or that changed after planning.
- Make pull behavior a configured pipeline, not a hidden reverse-conversion system.

## Current shape

The CLI exposes `init`, `pull`, `sync`, `lint`, `check`, and `diff`. A config contains named pipelines made from source, transform, lint, and output plugins. The built-ins cover eight platforms with an explicit support matrix.

Skill lint checks the standard Agent Skills fields, their length and metadata constraints, and platform-specific frontmatter drift. Severity overrides can change or disable any diagnostic rule.

## Non-goals

- Farmall does not claim semantic equivalence where a platform has no corresponding artifact type.
- Farmall does not rewrite native settings into a shared settings schema.
- Farmall does not overwrite an unmanaged destination to make a sync pass.
