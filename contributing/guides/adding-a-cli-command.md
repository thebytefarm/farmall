# Add a CLI command

Add a command without moving domain behavior into the executable entrypoint.

## Steps

### 1. Define the core operation

Put reusable behavior in `packages/core/src/`. Return `Result<T, CoreError>` when the operation has expected failures. Output plugins return desired files; they never write those files directly.

```ts
export interface Inspection {
  readonly artifacts: number;
}

export const inspectPipelineRun = (run: PipelineRun): Inspection => ({
  artifacts: run.emissions.length,
});
```

Export public core operations from `packages/core/src/index.ts`. Keep filesystem application in `plan.ts` so every write uses the same ownership, conflict, stale-plan, atomic-write, and rollback checks.

### 2. Define the Maltty command module

Add `packages/cli/src/commands/<command>.ts` with Maltty's `command()`. Keep one command per file. Reuse the configured-project options and flow from `commands/project-command.ts` when the command operates on a pipeline.

```ts
export const inspectCommand = command({
  description: "Inspect configured artifacts",
  options: projectOptions,
  async handler(ctx) {
    const run = await loadRun(ctx.args);
    if (!run.ok) return fail(ctx, run.error);
    const result = inspectPipelineRun(run.value);
    if (isJson(ctx.args)) {
      process.stdout.write(renderJson(result));
      return;
    }
    process.stdout.write(renderInspection(result));
  },
});
```

Keep process reads and writes in the handler. Use `ctx.fail` through the shared `fail` helper so `CoreError` values retain Farmall's error codes and status mapping.

### 3. Register the command

Export the command and add it to the map in `packages/cli/src/commands/index.ts`, which is consumed by the CLI entrypoint:

```ts
export const commands = {
  init: initCommand,
  pull: pullCommand,
  sync: syncCommand,
  lint: lintCommand,
  check: checkCommand,
  diff: diffCommand,
  inspect: inspectCommand,
};
```

Maltty derives command help and option parsing from this definition. Do not add a second parser or command registry.

### 4. Add rendering

Put stable plain-text and JSON formatting in `packages/cli/src/output.ts`. Put `CoreError` status mapping and production-used status predicates in `packages/cli/src/exit-status.ts`. Keep core independent of terminal formatting. Use `renderJson` for `--json` output.

Commands that both prepare and apply a pipeline should use `runAndApplyProject`. It preserves plan-then-summary text output and emits `{ run, applied }` as one JSON document only after a successful apply.

### 5. Update help and docs

- Write a precise Maltty command description and option descriptions.
- Update [CLI concepts](../concepts/cli.md).
- Add or update user docs under `docs/`.

### 6. Test behavior

- Unit-test the core operation next to its source.
- Preserve 100% statement, branch, function, and line coverage in core.
- Add CLI integration cases to `packages/cli/src/cli.integration.test.ts`.
- Exercise the built executable in a temporary repository and assert output, writes, and status codes.
- Unit-test output branches in `packages/cli/src/output.test.ts` and status policy in `packages/cli/src/exit-status.test.ts`.

```bash
pnpm build
pnpm --filter farmall dev -- --help
pnpm --filter farmall test
pnpm --filter @farmall/core exec vitest run --coverage
```

### 7. Validate

```bash
pnpm validate
pnpm docs:check
```

## Verification

1. The command appears in `farmall --help`.
2. Domain behavior lives in `@farmall/core`.
3. Expected core failures return `Result` values and produce non-zero CLI status codes.
4. All filesystem changes use the central planner.
5. Core coverage remains 100% for every configured metric.
6. CLI integration tests cover the command.
7. `pnpm validate` passes.

## References

- [CLI](../concepts/cli.md)
- [Architecture](../concepts/architecture.md)
- [Coding style](../standards/typescript/coding-style.md)
- [Errors](../standards/typescript/errors.md)
