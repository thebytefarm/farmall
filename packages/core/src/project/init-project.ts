import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import type { ApplyResult } from "../apply/types.ts";
import { applyPlan } from "../apply/apply-plan.ts";
import type { CoreError } from "../diagnostics/types.ts";
import { createPlan } from "../planning/create-plan.ts";
import type { PipelineRun } from "../pipeline/types.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import { initFiles } from "./init-templates.ts";

export const initProject = async (
  cwd: string,
): Promise<
  Result<{ readonly plan: PipelineRun["plan"]; readonly applied: ApplyResult }, CoreError>
> => {
  const root = resolve(cwd);
  try {
    await mkdir(root, { recursive: true });
  } catch (error) {
    return err({ code: "apply", message: errorMessage(error), path: root });
  }
  const plan = await createPlan(root, ".farmall-state.json", initFiles());
  if (!plan.ok) return plan;
  const applied = await applyPlan(plan.value);
  if (!applied.ok) return applied;
  return ok({ plan: plan.value, applied: applied.value });
};
