import { command } from "maltty";

import { hasErrors } from "../exit-status.ts";
import { fail, isJson, loadRun, printRun, projectOptions } from "./project-command.ts";

export const lintCommand = command({
  description: "Run configured semantic and portability checks",
  options: projectOptions,
  async handler(ctx) {
    const result = await loadRun(ctx.args);
    if (!result.ok) return fail(ctx, result.error);
    printRun(ctx, result.value, isJson(ctx.args));
    if (hasErrors(result.value.diagnostics)) {
      ctx.fail("Lint failed", { code: "FARMALL_LINT", exitCode: 1 });
    }
  },
});
