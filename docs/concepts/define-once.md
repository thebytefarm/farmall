# Define Once

Write each artifact one time, in one place. Everything else is projection.

> **WIP.** This page describes the design. The commands aren't wired up yet.

## The source of truth

`farmall` reads from a single source-of-truth directory, `.farmall/` by default. One subdirectory per
[target](./targets.md):

```
.farmall/
  AGENTS.md                 instructions — the canonical portable memory
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

## Instructions are authored as `AGENTS.md`

`AGENTS.md` is the default instruction format, always. It's the open standard nearly every agent reads
natively, so it's the least-lossy thing to author against. `farmall` projects it out to each agent's
format — `CLAUDE.md`, `.github/copilot-instructions.md`, and the rest — never the reverse. You write
`AGENTS.md`; the CLAUDE.md your Claude Code picks up is a link to it.

## The source directory is configurable

`.farmall/` is the default, not a requirement. Set [`source`](./configuration.md) to anything:

```ts
export default defineConfig({
  source: ".agents", // ride the emerging .agents convention
});
```

Point it at `.agents/` to align with the [dotagents](https://github.com/getsentry/dotagents)
convention that Codex and Cursor already read natively, or at a path of your own. The layout inside is
the same regardless of the name.

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
