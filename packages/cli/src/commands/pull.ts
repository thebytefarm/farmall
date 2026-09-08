import { command } from "maltty";

import { projectOptions, runAndApplyProject } from "./project-command.ts";

export const pullCommand = command({
  description: "Import through a configured pull pipeline",
  options: {
    ...projectOptions,
    pipeline: { ...projectOptions.pipeline, default: "pull" },
  },
  async handler(ctx) {
    await runAndApplyProject(ctx, ctx.args);
  },
});
