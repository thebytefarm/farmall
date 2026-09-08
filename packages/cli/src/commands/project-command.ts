import {
  applyPipelineRun,
  prepareProject,
  validatePipelineRun,
  type CoreError,
  type PipelineRun,
  type Result,
} from "@farmall/core";

import { exitCodeFor } from "../exit-status.ts";
import { renderApplied, renderJson, renderRun } from "../output.ts";

interface CommandContext {
  readonly fail: (
    message: string,
    options: { readonly code: string; readonly exitCode: number },
  ) => never;
}

export const projectOptions = {
  config: {
    type: "string",
    description: "Path to a Farmall config",
  },
  pipeline: {
    type: "string",
    default: "default",
    description: "Configured pipeline to run",
  },
  json: {
    type: "boolean",
    default: false,
    description: "Print structured JSON",
  },
} as const;

export const fail = (ctx: CommandContext, error: CoreError): never =>
  ctx.fail(error.message, {
    code: `FARMALL_${error.code.toUpperCase()}`,
    exitCode: exitCodeFor(error),
  });

const pipelineName = (args: Readonly<Record<string, unknown>>): string => {
  if (typeof args.pipeline === "string") return args.pipeline;
  return "default";
};

export const loadRun = async (
  args: Readonly<Record<string, unknown>>,
): Promise<Result<PipelineRun, CoreError>> => {
  const pipeline = pipelineName(args);
  if (typeof args.config === "string") {
    return prepareProject({ cwd: process.cwd(), configPath: args.config, pipeline });
  }
  return prepareProject({ cwd: process.cwd(), pipeline });
};

export const isJson = (args: Readonly<Record<string, unknown>>): boolean => args.json === true;

export const printJson = (ctx: CommandContext, value: unknown): void => {
  const rendered = renderJson(value);
  if (!rendered.ok) return fail(ctx, rendered.error);
  process.stdout.write(rendered.value);
};

export const printRun = (ctx: CommandContext, run: PipelineRun, json: boolean): void => {
  if (json) {
    printJson(ctx, run);
    return;
  }
  process.stdout.write(renderRun(run));
};

export const assertRunnable = (ctx: CommandContext, run: PipelineRun): void => {
  const result = validatePipelineRun(run);
  if (!result.ok) fail(ctx, result.error);
};

export const runAndApplyProject = async (
  ctx: CommandContext,
  args: Readonly<Record<string, unknown>>,
): Promise<void> => {
  const result = await loadRun(args);
  if (!result.ok) return fail(ctx, result.error);
  const json = isJson(args);
  if (!json) process.stdout.write(renderRun(result.value));
  const applied = await applyPipelineRun(result.value);
  if (!applied.ok) return fail(ctx, applied.error);
  if (json) {
    printJson(ctx, { run: result.value, applied: applied.value });
    return;
  }
  process.stdout.write(renderApplied(applied.value));
};
