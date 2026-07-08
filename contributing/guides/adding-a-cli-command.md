# Add a CLI Command

Add a new subcommand to the `farmall` CLI end-to-end.

> **Status: WIP — read this before you start.** The CLI does not use its command framework yet. `packages/cli/src/index.ts` is a single `parseArgs` stub that prints help and replies "not wired up yet" to everything else. The planned surface is `init`, `pull`, `sync <target>`, `lint`, `check`, `diff` (see [VISION.md](https://github.com/thebytefarm/farmall/blob/main/VISION.md)). This guide covers both: how to extend the stub today, and the intended [`maltty`](https://github.com/thebytefarm/maltty)-based pattern the CLI will migrate to. Match whichever shape the entrypoint is in when you touch it.

## Prerequisites

- Familiarity with the [architecture](../concepts/architecture.md) and the planned command surface in [VISION.md](https://github.com/thebytefarm/farmall/blob/main/VISION.md)
- The project builds: `pnpm build` and `pnpm --filter farmall typecheck`

## The command surface

Every command name should come from the canonical set in VISION.md. Do not invent commands outside it without updating VISION.md first.

| Command                 | Does                                                           |
| ----------------------- | -------------------------------------------------------------- |
| `farmall init`          | Scaffold a source-of-truth directory in your repo.             |
| `farmall pull`          | Import existing per-agent config into the source of truth.     |
| `farmall sync <target>` | Project the source of truth out to every platform.             |
| `farmall lint`          | Check skills for cross-platform support.                       |
| `farmall check`         | Dry-run: what would change, what's out of sync, what's broken. |
| `farmall diff`          | Show drift between the source of truth and each agent.         |

Sync targets (the argument to `sync`) are `instructions`, `rules`, `skills`, `subagents`, `agents`. Keep the `SYNC_TARGETS` / `PLATFORMS` constants in `@farmall/core` aligned with VISION.md — the current stub drifts (see [Architecture](../concepts/architecture.md#current-state-of-farmallcore)); fix it, don't copy it.

## Today: extend the stub

The current entrypoint (`packages/cli/src/index.ts`) parses flags with `node:util`'s `parseArgs`, then branches on positionals. To wire a real command in place, thread it through `@farmall/core` and dispatch on the first positional.

### 1. Add the engine function in `@farmall/core`

Real work lives in `packages/core/src/`, not in the CLI. Add a function that returns a `Result`:

```ts
// packages/core/src/lint.ts
import { ok, type Result } from "./index.ts";

export const lint = (): Result<string> => ok("lint — not implemented yet");
```

Export it from `packages/core/src/index.ts`. Follow the house style: `const` only, no classes, return `Result` for expected failures, side effects at the edges.

### 2. Dispatch in the CLI

In `packages/cli/src/index.ts`, branch on the first positional and print the engine's result:

```ts
import { lint } from "@farmall/core";

// inside main(), after help/version handling:
const [command] = positionals;
if (command === "lint") {
  const result = lint();
  write(process.stdout, result.ok ? result.value : `error: ${result.error}`);
  return result.ok ? 0 : 1;
}
```

Update the `HELP` string so the command moves out of "planned" once it does real work.

## Intended: the `maltty` pattern

`maltty` is already a CLI dependency. When the entrypoint migrates to it, commands become files created with the `command()` factory and auto-discovered — no manual `if` dispatch.

### 1. Create the command file

The filename becomes the command name (`lint.ts` → `farmall lint`):

```ts
import { command } from "maltty";
import { z } from "zod";

import { lint } from "@farmall/core";

export default command({
  description: "Lint skills for cross-platform support",
  args: z.object({
    platform: z.string().optional(),
    fix: z.boolean().optional(),
  }),
  handler: async (ctx) => {
    ctx.spinner.start("Linting");
    const result = lint();
    ctx.spinner.stop(result.ok ? result.value : "Lint failed");
  },
});
```

### 2. Registration

Commands are auto-registered by the `maltty` autoloader when placed in the commands directory. A file is discovered if it:

- has a `.ts` or `.js` extension (not `.d.ts`),
- does not start with `_` or `.`,
- exports a default `Command` from the `command()` factory.

Subcommands (e.g. `sync skills`) go in a directory with an `index.ts` parent and one file per subcommand. See the [maltty command guide](https://github.com/thebytefarm/maltty/blob/main/contributing/guides/adding-a-cli-command.md) for the full pattern.

## Write tests

Keep logic in `@farmall/core` and test it there with vitest (`packages/core/src/*.test.ts`), mirroring the existing `index.test.ts`. Engine functions return `Result`, so tests assert on `result.ok` and `result.value` — no mock filesystem needed for pure logic.

- Test the success path.
- Test each failure path returns `err(...)` with the expected message.
- Once the CLI dispatches, add a thin integration test that the command routes and prints.

## Verify

```bash
pnpm --filter @farmall/core test
pnpm validate            # oxfmt --check && oxlint && turbo run typecheck test
```

Then run the CLI:

```bash
pnpm --filter farmall build
node packages/cli/dist/index.js <command> --help
```

## Troubleshooting

### Command prints "not wired up yet"

**Issue:** Your new command still hits the fallback message.

**Fix (stub):** Add the positional branch in `main()` before the final fallback `write`. **Fix (maltty):** Confirm the file is in the commands directory, has a valid extension, doesn't start with `_`/`.`, and exports a default `command()`.

### `@farmall/core` changes not visible in the CLI

**Issue:** The CLI still uses the old engine behavior.

**Fix:** Rebuild core first — turbo builds in dependency order, so `pnpm build` from the root works, or rebuild just core with `pnpm --filter @farmall/core build`.

### tsgo type errors on import extensions

**Issue:** Imports fail typecheck over `.ts` extensions.

**Fix:** The repo uses `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`. Import intra-repo source with the `.ts` extension (`./index.ts`); tsgo rewrites it on emit. Do not switch to `.js` in source.

## References

- [Architecture](../concepts/architecture.md)
- [Tech Stack](../concepts/tech-stack.md)
- [VISION.md](https://github.com/thebytefarm/farmall/blob/main/VISION.md)
- [maltty: Adding a CLI Command](https://github.com/thebytefarm/maltty/blob/main/contributing/guides/adding-a-cli-command.md)
