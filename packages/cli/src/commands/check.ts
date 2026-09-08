import { command } from "maltty";

import { hasChanges } from "../exit-status.ts";
import {
  assertRunnable,
  fail,
  isJson,
  loadRun,
  printRun,
  projectOptions,
} from "./project-command.ts";

export const checkCommand = command({
  description: "Report drift and conflicts without writing",
  options: projectOptions,
  async handler(ctx) {
    const result = await loadRun(ctx.args);
    if (!result.ok) return fail(ctx, result.error);
    printRun(ctx, result.value, isJson(ctx.args));
    assertRunnable(ctx, result.value);
    if (hasChanges(result.value.plan.actions)) process.exitCode = 1;
  },
});
