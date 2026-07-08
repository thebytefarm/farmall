# Adopt farmall into a Repo

Take a repo with agent config already scattered across `.claude/`, `.cursor/`, and a stray `AGENTS.md`, and consolidate it into one source of truth.

> **WIP.** This page describes the design. `init` and `pull` aren't wired up yet.

## Before

A repo that grew agent config organically has copies everywhere, each edited independently and already drifting:

```
your-repo/
  AGENTS.md                        hand-written, mostly current
  CLAUDE.md                        an older fork of the same instructions
  .claude/
    rules/typescript.md
    skills/review-pr/SKILL.md
  .cursor/
    rules/typescript.mdc           same rule, Cursor frontmatter
    skills/review-pr/SKILL.md      a copy of the Claude one
  .github/
    copilot-instructions.md        yet another instructions fork
```

Three copies of your instructions, two copies of the review-pr skill, and a rule maintained twice. Nothing links; everything drifts.

## Step 1 — scaffold the source of truth

```bash
farmall init --platforms claude-code,cursor,copilot
```

`init` creates an empty `.farmall/` tree and a `farmall.config.ts` seeded with the platforms you named. It does not touch your existing config — importing that is `pull`'s job.

## Step 2 — pull existing config in

```bash
farmall pull --dry-run     # inspect first
farmall pull
```

`pull` reads what each configured platform already has on disk and consolidates it under `source`. For each [target](../concepts/targets.md) it picks the least-lossy existing copy — `AGENTS.md` over the CLAUDE.md fork for instructions — and moves it into `.farmall/`, de-duplicating copies that are the same artifact under different names.

Scope it to one platform when you only trust one source:

```bash
farmall pull skills --platform claude-code
```

## After

```
your-repo/
  .farmall/
    AGENTS.md                      one instructions file, canonical
    rules/typescript.md            one rule, portable markdown
    skills/review-pr/SKILL.md      one skill directory
  farmall.config.ts
```

The scattered copies are gone from the source's perspective — the next [`sync`](../concepts/sync.md) replaces them with symlinks back into `.farmall/`:

```bash
farmall sync
```

```
CLAUDE.md                          → .farmall/AGENTS.md
AGENTS.md                          → .farmall/AGENTS.md
.github/copilot-instructions.md    → .farmall/AGENTS.md
.claude/rules/typescript.md        → .farmall/rules/typescript.md
.cursor/rules/typescript.mdc       → .farmall/rules/typescript.md
```

From here you edit one file and every agent sees the change. Run [`farmall check`](./check-and-diff.md) before committing to confirm the link tree matches config, and [`farmall lint`](./write-a-portable-skill.md) to catch anything that won't behave across the platforms you pulled from.

## References

- [Define Once](../concepts/define-once.md)
- [Sync](../concepts/sync.md)
- [CLI Reference](../reference/cli.md)
- [Check and Diff](./check-and-diff.md)
