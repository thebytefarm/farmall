# Vision

One source of truth for **all** your AI coding agents. Write config once, project it everywhere,
and lint it so it actually behaves the same on every agent.

## Commands

| Command                 | Does                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `farmall init`          | Scaffold a source-of-truth directory in your repo.                |
| `farmall pull`          | Import existing per-agent config into the source of truth.        |
| `farmall sync <target>` | Project the source of truth out to every platform.                |
| `farmall lint`          | Check skills for cross-platform support — the reason this exists. |
| `farmall check`         | Dry-run: what would change, what's out of sync, what's broken.    |
| `farmall diff`          | Show drift between the source of truth and each agent.            |

## Sync targets

| Target         | Source of truth for                                                    |
| -------------- | ---------------------------------------------------------------------- |
| `instructions` | portable project memory — authored as `AGENTS.md`, projected per agent |
| `rules`        | scoped rule files with frontmatter/glob activation                     |
| `skills`       | reusable agent skills (`SKILL.md` & friends)                           |
| `subagents`    | subagent definitions                                                   |
| `agents`       | agent-level config in each tool's expected location                    |

`instructions` and `rules` are deliberately separate. Instructions are the portable memory almost
every agent reads — `AGENTS.md` is the default format, always, and we project it to `CLAUDE.md` and
the rest. Rules are the scoped, frontmatter-driven files agents load conditionally
(`.cursor/rules/*.mdc`, `.claude/rules/*.md`, `.devin/rules/*.md`).

## Platforms

Claude Code · Cursor · Codex · Copilot · opencode · Devin · pi — more as the ecosystem grows.

## Foundation

We don't rebuild the commodity. Skill loading, source resolution, the git cache, and
trust validation come from [`@sentry/dotagents-lib`](https://github.com/getsentry/dotagents)
(MIT, one dependency). It's grammar-agnostic — it knows only source strings, `SKILL.md`,
and the cache, not `agents.toml` — so we depend on the plumbing without inheriting their
manifest.

That frees us to spend effort on the parts nobody else does: **lint**, **rules sync**, and
`pull`. Distribution stays **pure symlink** — one physical `SKILL.md`, every runtime drops
the frontmatter keys it doesn't know. Lint is what tells you when that bet is wrong for a
given agent.

The CLI itself is built on [`maltty`](https://github.com/thebytefarm/maltty) — command
routing, config loading (`defineConfig`), prompts, terminal formatting, YAML, and templating
for projection all come from the framework, so farmall carries no à-la-carte CLI deps.
Functional helpers come from [`massaman`](https://www.npmjs.com/package/massaman). Node 24
built-ins cover the rest (`fs.glob`, `fs.symlink`/`realpath`, `structuredClone`, native
TS config execution) — no glob, color, or clone libraries.

## Configuration

`farmall.config.ts` (also `.js`, `.yaml`, `.json`) is the single source of truth for **what's
supported and how it syncs** — type-safe via `defineConfig`.

- **Targets & platforms** — declare which artifacts sync to which agents.
- **Per-target args** — output paths, formats, include/exclude globs.
- **Lint rules** — enable/disable, set severity, and override per platform.

```ts
// farmall.config.ts
import { defineConfig } from "farmall";

export default defineConfig({
  source: ".farmall", // your source of truth
  platforms: ["claude-code", "cursor", "codex"],
  sync: {
    instructions: { format: "agents-md" },
    rules: true,
    skills: { include: "skills/**" },
    subagents: true,
    agents: false,
  },
  lint: {
    rules: {
      "trigger-compat": "error",
      "frontmatter-drift": "warn",
      portability: "error",
    },
    // narrow or relax rules for a specific platform
    overrides: [{ platform: "codex", rules: { "frontmatter-drift": "off" } }],
  },
});
```

`.yaml` / `.json` take the same shape for anyone who'd rather skip a TS file.

## Lint (the differentiator)

Everyone can copy files. Nobody checks whether the copy _works_:

- **Trigger compatibility** — will the skill's description fire on each agent, or just the one you wrote it for?
- **Frontmatter drift** — which fields does each agent honor, and which get silently dropped?
- **Portability** — will a subagent written for one tool run on another at all?

Sync gets config _there_. Lint tells you whether it will _behave_.

## Roadmap

- [x] Reserve the name, ship the scaffold + docs.
- [ ] **Adopt `@sentry/dotagents-lib`** — reuse SKILL.md loading, source resolution, git cache, and trust.
- [ ] **`farmall.config.ts`** — declarative support matrix + per-target args + lint overrides.
- [ ] **`lint` MVP** — cross-platform skill checks (lead with the gap, not the commodity).
- [ ] **`sync skills` + `sync instructions`** — the core loop for the two most common artifacts.
- [ ] **`init` + `pull`** — adopt into an existing repo without hand-wiring.
- [ ] **`sync subagents`** — the still-experimental-everywhere target, done well.
- [ ] **`check` / `diff`** — safe dry-runs and drift visibility.
- [ ] **Widen platform coverage** — deepen per-agent support beyond the core set.

## Non-goals

- Not another 40-agent sync race — cover the agents people actually use, deeply.
- Not a rules format — bring your own; we sync and lint what you already write.
