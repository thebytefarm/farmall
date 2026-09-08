import type { Emission } from "../artifacts/types.ts";
import type { Diagnostic, Severity } from "../diagnostics/types.ts";
import type { DesiredFile, Plan } from "../planning/types.ts";
import type { PluginUse } from "../plugins/types.ts";

export interface PipelineConfig {
  readonly sources: readonly PluginUse[];
  readonly transforms?: readonly PluginUse[];
  readonly lint?: readonly PluginUse[];
  readonly outputs: readonly PluginUse[];
}

export interface FarmallConfig {
  readonly state?: string;
  readonly plugins?: readonly string[];
  readonly pipelines: Readonly<Record<string, PipelineConfig>>;
  readonly severity?: Readonly<Record<string, Severity | "off">>;
}

export interface ResolvedConfig {
  readonly path: string;
  readonly root: string;
  readonly config: FarmallConfig;
}

export interface PipelineRun {
  readonly pipeline: string;
  readonly emissions: readonly Emission[];
  readonly desired: readonly DesiredFile[];
  readonly diagnostics: readonly Diagnostic[];
  readonly plan: Plan;
}
