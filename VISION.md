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

| Target      | Source of truth for                                    |
| ----------- | ------------------------------------------------------ |
| `skills`    | reusable agent skills (`SKILL.md` & friends)           |
| `rules`     | `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and variants |
| `subagents` | subagent definitions                                   |
| `agents`    | agent-level config in each tool's expected location    |

## Platforms

Claude Code · Cursor · Codex · Windsurf · Copilot · opencode — more as the ecosystem grows.

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
    skills: { include: "skills/**" },
    rules: { format: "agents-md" },
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
- [ ] **`farmall.config.ts`** — declarative support matrix + per-target args + lint overrides.
- [ ] **`lint` MVP** — cross-platform skill checks (lead with the gap, not the commodity).
- [ ] **`sync skills` + `sync rules`** — the core loop for the two most common artifacts.
- [ ] **`init` + `pull`** — adopt into an existing repo without hand-wiring.
- [ ] **`sync subagents`** — the still-experimental-everywhere target, done well.
- [ ] **`check` / `diff`** — safe dry-runs and drift visibility.
- [ ] **Widen platform coverage** — deepen per-agent support beyond the core set.

## Non-goals

- Not another 40-agent sync race — cover the agents people actually use, deeply.
- Not a rules format — bring your own; we sync and lint what you already write.
