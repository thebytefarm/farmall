import type { ApplyResult } from "../apply/types.ts";
import { applyPlan } from "../apply/apply-plan.ts";
import { loadConfig } from "../config/load-config.ts";
import type { CoreError } from "../diagnostics/types.ts";
import { runPipeline } from "../pipeline/run-pipeline.ts";
import type { PipelineRun } from "../pipeline/types.ts";
import { err, ok, type Result } from "../result.ts";

export interface ProjectOptions {
  readonly cwd: string;
  readonly configPath?: string;
  readonly pipeline?: string;
}

export const validatePipelineRun = (run: PipelineRun): Result<void, CoreError> => {
  const blocking = run.diagnostics.find((diagnostic) => diagnostic.severity === "error");
  if (blocking) {
    if (blocking.path !== undefined && blocking.plugin !== undefined) {
      return err({
        code: "lint",
        message: blocking.message,
        path: blocking.path,
        plugin: blocking.plugin,
      });
    }
    if (blocking.path !== undefined) {
      return err({ code: "lint", message: blocking.message, path: blocking.path });
    }
    if (blocking.plugin !== undefined) {
      return err({ code: "lint", message: blocking.message, plugin: blocking.plugin });
    }
    return err({ code: "lint", message: blocking.message });
  }
  const conflict = run.plan.actions.find((action) => action.action === "conflict");
  if (!conflict) return ok(undefined);
  return err({
    code: "conflict",
    message: conflict.reason ?? "Pipeline has output conflicts",
    path: conflict.path,
  });
};

export const applyPipelineRun = async (
  run: PipelineRun,
): Promise<Result<ApplyResult, CoreError>> => {
  const valid = validatePipelineRun(run);
  if (!valid.ok) return valid;
  return applyPlan(run.plan);
};

export const prepareProject = async (
  options: ProjectOptions,
): Promise<Result<PipelineRun, CoreError>> => {
  const resolved = await loadConfig(options.cwd, options.configPath);
  if (!resolved.ok) return resolved;
  return runPipeline(resolved.value.root, resolved.value.config, options.pipeline);
};

export const syncProject = async (
  options: ProjectOptions,
): Promise<Result<{ readonly run: PipelineRun; readonly applied: ApplyResult }, CoreError>> => {
  const run = await prepareProject(options);
  if (!run.ok) return run;
  const applied = await applyPipelineRun(run.value);
  if (!applied.ok) return applied;
  return ok({ run: run.value, applied: applied.value });
};
