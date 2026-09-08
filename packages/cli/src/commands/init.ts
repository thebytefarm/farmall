import { initProject } from "@farmall/core";
import { command } from "maltty";

import { renderApplied } from "../output.ts";
import { fail, isJson, printJson, projectOptions } from "./project-command.ts";

export const initCommand = command({
  description: "Create an editable Farmall config and source layout",
  options: {
    json: projectOptions.json,
  },
  async handler(ctx) {
    const result = await initProject(process.cwd());
    if (!result.ok) return fail(ctx, result.error);
    if (isJson(ctx.args)) printJson(ctx, result.value);
    else process.stdout.write(`Initialized Farmall: ${renderApplied(result.value.applied)}`);
  },
});
