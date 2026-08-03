# Define Once

Write each artifact one time, in one place. Everything else is projection.

> **WIP.** This page describes the design. The commands aren't wired up yet.

## Two homes, by design

`farmall` reads from two places, and they're deliberately different:

1. **`AGENTS.md` — instructions — always in the tree itself.** At the repo root, and nestable at any
   directory level. Never inside the source directory.
2. **The source directory — everything else** — rules, skills, subagents, and agents. `.farmall/` by
   default.

## `AGENTS.md` is the base, always

Instructions live as `AGENTS.md` in your working tree — at the root, and nested wherever you want
directory-scoped memory:

```
AGENTS.md                   root instructions
packages/api/AGENTS.md      instructions scoped to packages/api
```

`AGENTS.md` is the open standard nearly every agent reads natively, so it's the least-lossy thing to
author against. `farmall` reads each one **in place** and projects it to the per-agent instruction
file at the **same level** — root `AGENTS.md` → root `CLAUDE.md`, `packages/api/AGENTS.md` →
`packages/api/CLAUDE.md`, and so on — never the reverse. The `CLAUDE.md` your Claude Code picks up is
a link to the `AGENTS.md` next to it. `AGENTS.md` is never moved into the source directory.

## The source directory — everything else

Rules, skills, subagents, and agents live under **one** source directory. `.farmall/` is the default:

```
.farmall/
  rules/
    typescript.md           scoped rule files
    security.md
  skills/
    review-pr/
      SKILL.md              a skill and its supporting files
      references/
  subagents/
    code-reviewer.md
  agents/
    defaults.json           agent-level config / model selection
farmall.config.ts
```

There is exactly one physical copy of each artifact. You edit it here; you never edit the projected
copies in `.claude/`, `.cursor/`, and friends — those are [symlinks](./sync.md) back to this tree.

## Pick one source, never merged

The source is a single directory. `.farmall/` is the default, but you choose exactly **one** of the
recognized roots — `farmall` never reads from several at once:

```ts
export default defineConfig({
  source: ".agents", // or ".farmall" (default), or "./skills"
});
```

| `source`   | For repos that…                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| `.farmall` | want farmall's own namespace (the default).                                                                    |
| `.agents`  | already use the [dotagents](https://github.com/getsentry/dotagents) convention Codex and Cursor read natively. |
| `./skills` | already keep skills at the repo root.                                                                          |

Set it to a custom path if none of those fit. Whatever you pick, that one directory is the source —
there's no auto-discovery across the others.

## Why one tree

- **One edit, everywhere.** Fix a skill once; every agent sees the fix because every agent links to
  the same file.
- **No drift by construction.** Copies drift. Symlinks can't — there's nothing to fall out of sync.
- **Reviewable.** The whole agent surface of your repo lives under one directory in version control.

## References

- [Overview](./overview.md)
- [Targets](./targets.md)
- [Sync](./sync.md)
- [Configuration](./configuration.md)
