import { createRequire } from "node:module";

const packageMetadata = createRequire(import.meta.url)("../package.json") as Readonly<{
  version: string;
}>;

export {
  BUILTIN_PLUGINS,
  builtInOutput,
  filesystemOutput,
  filesystemSource,
  platformSource,
  platformIds,
  stage,
} from "./builtins/index.ts";
export { loadConfig } from "./config/load-config.ts";
export { defineConfig, farmallConfigSchema } from "./config/schema.ts";
export { applyPlan } from "./apply/apply-plan.ts";
export { digest } from "./filesystem/content-digest.ts";
export { createPlan } from "./planning/create-plan.ts";
export { loadManifest } from "./planning/manifest.ts";
export { renderDiff } from "./render/plan-diff.ts";
export { runPipeline } from "./pipeline/run-pipeline.ts";
export { createPluginContext } from "./plugins/context.ts";
export { loadPlugins } from "./plugins/load-plugins.ts";
export { resolvePlugin } from "./plugins/resolve-plugin.ts";
export {
  applyPipelineRun,
  prepareProject,
  syncProject,
  validatePipelineRun,
} from "./project/project-run.ts";
export { initProject } from "./project/init-project.ts";
export { err, errorMessage, ok } from "./result.ts";
export { ARTIFACT_KINDS } from "./types.ts";
export { isJsonValue, jsonObjectSchema, jsonValueSchema } from "./artifacts/json-value.ts";

export type { Result } from "./result.ts";
export type { ProjectOptions } from "./project/project-run.ts";
export type {
  ApplyResult,
  ApplyWarning,
  ApplicablePlan,
  Artifact,
  ArtifactFile,
  ArtifactKind,
  CoreError,
  DesiredFile,
  Diagnostic,
  DirectOutput,
  Emission,
  FileContent,
  FileRecord,
  FarmallConfig,
  FarmallPlugin,
  JsonObject,
  JsonValue,
  PosixMode,
  LintPlugin,
  Manifest,
  ManifestEntry,
  OutputPlugin,
  PipelineConfig,
  PipelineRun,
  Plan,
  PlanAction,
  PlanActionKind,
  CreatePlanAction,
  UpdatePlanAction,
  DeletePlanAction,
  DesiredNoopPlanAction,
  AbsentNoopPlanAction,
  DesiredConflictPlanAction,
  StaleConflictPlanAction,
  PluginContext,
  PluginUse,
  ResolvedConfig,
  Severity,
  SourcePlugin,
  StageResult,
  TransformPlugin,
  WritePolicy,
} from "./types.ts";

export const FARMALL_VERSION = packageMetadata.version;
