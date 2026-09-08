import { renderDiff } from "@farmall/core";
import { command } from "maltty";

import { hasChanges } from "../exit-status.ts";
import {
  assertRunnable,
  fail,
  isJson,
  loadRun,
  printJson,
  projectOptions,
} from "./project-command.ts";

export const diffCommand = command({
  description: "Show deterministic output differences without writing",
  options: projectOptions,
  async handler(ctx) {
    const result = await loadRun(ctx.args);
    if (!result.ok) return fail(ctx, result.error);
    if (isJson(ctx.args)) printJson(ctx, result.value.plan);
    else process.stdout.write(renderDiff(result.value.plan));
    assertRunnable(ctx, result.value);
    if (hasChanges(result.value.plan.actions)) process.exitCode = 1;
  },
});
