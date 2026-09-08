import { command } from "maltty";

import { projectOptions, runAndApplyProject } from "./project-command.ts";

export const syncCommand = command({
  description: "Compile and apply a configured artifact pipeline",
  options: projectOptions,
  async handler(ctx) {
    await runAndApplyProject(ctx, ctx.args);
  },
});
