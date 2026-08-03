# Quick Start

> **WIP.** `farmall` is a placeholder release today — the commands below are the plan, not yet the
> behavior. Installing it now just reserves your spot.

## Install

```bash
npm install -g farmall
# or run it without installing
npx farmall --help
```

## The planned flow

### 1. Scaffold a source of truth

```bash
farmall init
```

Creates `.farmall/` and a typed `farmall.config.ts`. Author your instructions as `AGENTS.md` at the
repo root (nest more `AGENTS.md` files wherever you want), and drop rules under `.farmall/rules/`,
skills under `.farmall/skills/`.

### 2. Declare your platforms

```ts
// farmall.config.ts
import { defineConfig } from "farmall";

export default defineConfig({
  platforms: ["claude-code", "cursor", "codex"],
  sync: {
    instructions: { format: "agents-md" },
    rules: true,
    skills: true,
  },
});
```

### 3. Sync, then lint

```bash
farmall sync             # project every target to every platform (by symlink)
farmall sync skills      # or a single target
farmall lint             # check cross-platform support — the reason this exists
```

Already have per-agent config? Import it instead of hand-wiring:

```bash
farmall pull             # consolidate existing .claude/, .cursor/, AGENTS.md into the source
```

See the [CLI reference](../reference/cli.md) for the full command surface.

## What works today

```bash
farmall --help           # prints the planned command surface
farmall --version        # 0.0.1
```

Everything else is a friendly "not wired up yet." That's on purpose — the shape is real, the logic is
coming.

## References

- [Introduction](./introduction.md)
- [Overview](../concepts/overview.md)
- [Configuration](../concepts/configuration.md)
- [CLI Reference](../reference/cli.md)
