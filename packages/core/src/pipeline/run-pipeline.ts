import { countBy } from "massaman/array";

import { BUILTIN_PLUGINS } from "../builtins/index.ts";
import type { CoreError } from "../diagnostics/types.ts";
import { createPlan } from "../planning/create-plan.ts";
import { createPluginContext } from "../plugins/context.ts";
import { loadPlugins } from "../plugins/load-plugins.ts";
import { err, ok, type Result } from "../result.ts";
import { runLint, runOutputs, runSources, runTransforms } from "./run-stages.ts";
import { applySeverity } from "./severity.ts";
import type { FarmallConfig, PipelineConfig, PipelineRun } from "./types.ts";

const ensureUniqueNames = (pipeline: PipelineConfig): Result<void, CoreError> => {
  const uses = [
    ...pipeline.sources,
    ...(pipeline.transforms ?? []),
    ...(pipeline.lint ?? []),
    ...pipeline.outputs,
  ];
  const names = uses.flatMap((use) => {
    if (use.name === undefined) return [];
    return [use.name];
  });
  const nameCounts = countBy(names, (name) => name);
  const duplicate = names.find((name) => nameCounts[name]! > 1);
  if (!duplicate) return ok(undefined);
  return err({ code: "config", message: `Duplicate plugin instance name: ${duplicate}` });
};

export const runPipeline = async (
  root: string,
  config: FarmallConfig,
  pipelineName = "default",
): Promise<Result<PipelineRun, CoreError>> => {
  const pipeline = config.pipelines[pipelineName];
  if (!pipeline) return err({ code: "config", message: `Unknown pipeline: ${pipelineName}` });
  const uniqueNames = ensureUniqueNames(pipeline);
  if (!uniqueNames.ok) return uniqueNames;
  const plugins = await loadPlugins(root, BUILTIN_PLUGINS, config.plugins ?? []);
  if (!plugins.ok) return plugins;
  const context = createPluginContext(root);
  const sources = await runSources(pipeline.sources, plugins.value, context);
  if (!sources.ok) return sources;
  const transforms = await runTransforms(
    sources.value.value,
    pipeline.transforms ?? [],
    plugins.value,
    context,
  );
  if (!transforms.ok) return transforms;
  const outputs = await runOutputs(
    transforms.value.value,
    pipeline.outputs,
    plugins.value,
    context,
  );
  if (!outputs.ok) return outputs;
  const lint = await runLint(transforms.value.value, pipeline.lint ?? [], plugins.value, context);
  if (!lint.ok) return lint;
  const diagnostics = applySeverity(
    [
      ...sources.value.diagnostics,
      ...transforms.value.diagnostics,
      ...outputs.value.diagnostics,
      ...lint.value,
    ],
    config.severity,
  );
  const plan = await createPlan(
    root,
    config.state ?? ".farmall-state.json",
    outputs.value.value,
    pipelineName,
  );
  if (!plan.ok) return plan;
  return ok({
    pipeline: pipelineName,
    emissions: transforms.value.value,
    desired: outputs.value.value,
    diagnostics,
    plan: plan.value,
  });
};
