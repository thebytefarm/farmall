import { reduceAsync } from "massaman/array";
import { z } from "zod";

import type { Emission } from "../artifacts/types.ts";
import type { CoreError, Diagnostic } from "../diagnostics/types.ts";
import type { DesiredFile } from "../planning/types.ts";
import { createPluginContext } from "../plugins/context.ts";
import { immutableClone } from "../plugins/immutable.ts";
import { immutablePluginOptions, resolvePlugin } from "../plugins/resolve-plugin.ts";
import {
  lintResultSchema,
  outputResultSchema,
  sourceResultSchema,
  transformResultSchema,
} from "../plugins/result-schemas.ts";
import type { FarmallPlugin, PluginUse, StageResult } from "../plugins/types.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";

type Context = ReturnType<typeof createPluginContext>;

const runUses = async <T>(
  uses: readonly PluginUse[],
  initial: T,
  runUse: (current: T, use: PluginUse) => Promise<Result<T, CoreError>>,
): Promise<Result<T, CoreError>> =>
  reduceAsync(
    uses,
    async (current: Result<T, CoreError>, use) => {
      if (!current.ok) return current;
      return runUse(current.value, use);
    },
    ok(initial),
  );

const runExternal = async <T>(
  pluginId: string,
  run: () => Promise<unknown>,
  schema: z.ZodType<Result<T, CoreError>>,
): Promise<Result<T, CoreError>> => {
  try {
    const parsed = schema.safeParse(await run());
    if (parsed.success) return immutableClone(parsed.data);
    return err({
      code: "plugin",
      message: `Invalid result from ${pluginId}: ${z.prettifyError(parsed.error)}`,
      plugin: pluginId,
    });
  } catch (error) {
    return err({ code: "plugin", message: errorMessage(error), plugin: pluginId });
  }
};

const immutableEmissions = (emissions: readonly Emission[]): readonly Emission[] =>
  immutableClone(emissions);

export const runSources = async (
  uses: readonly PluginUse[],
  plugins: readonly FarmallPlugin[],
  context: Context,
): Promise<Result<StageResult<readonly Emission[]>, CoreError>> =>
  runUses(
    uses,
    { value: [], diagnostics: [] } as StageResult<readonly Emission[]>,
    async (current, use) => {
      const resolved = resolvePlugin(plugins, use, "source");
      if (!resolved.ok) return resolved;
      const result = await runExternal<StageResult<readonly Emission[]>>(
        use.use,
        () => resolved.value.run(immutablePluginOptions(use), context),
        sourceResultSchema,
      );
      if (!result.ok) return result;
      return ok({
        value: [...current.value, ...result.value.value],
        diagnostics: [...current.diagnostics, ...result.value.diagnostics],
      });
    },
  );

export const runTransforms = async (
  emissions: readonly Emission[],
  uses: readonly PluginUse[],
  plugins: readonly FarmallPlugin[],
  context: Context,
): Promise<Result<StageResult<readonly Emission[]>, CoreError>> =>
  runUses(
    uses,
    { value: emissions, diagnostics: [] } as StageResult<readonly Emission[]>,
    async (current, use) => {
      const resolved = resolvePlugin(plugins, use, "transform");
      if (!resolved.ok) return resolved;
      const result = await runExternal<StageResult<readonly Emission[]>>(
        use.use,
        () =>
          resolved.value.run(
            immutableEmissions(current.value),
            immutablePluginOptions(use),
            context,
          ),
        transformResultSchema,
      );
      if (!result.ok) return result;
      return ok({
        value: result.value.value,
        diagnostics: [...current.diagnostics, ...result.value.diagnostics],
      });
    },
  );

export const runOutputs = async (
  emissions: readonly Emission[],
  uses: readonly PluginUse[],
  plugins: readonly FarmallPlugin[],
  context: Context,
): Promise<Result<StageResult<readonly DesiredFile[]>, CoreError>> =>
  runUses(
    uses,
    { value: [], diagnostics: [] } as StageResult<readonly DesiredFile[]>,
    async (current, use) => {
      const resolved = resolvePlugin(plugins, use, "output");
      if (!resolved.ok) return resolved;
      const result = await runExternal<StageResult<readonly DesiredFile[]>>(
        use.use,
        () =>
          resolved.value.run(immutableEmissions(emissions), immutablePluginOptions(use), context),
        outputResultSchema,
      );
      if (!result.ok) return result;
      return ok({
        value: [...current.value, ...result.value.value],
        diagnostics: [...current.diagnostics, ...result.value.diagnostics],
      });
    },
  );

export const runLint = async (
  emissions: readonly Emission[],
  uses: readonly PluginUse[],
  plugins: readonly FarmallPlugin[],
  context: Context,
): Promise<Result<readonly Diagnostic[], CoreError>> =>
  runUses(uses, [] as readonly Diagnostic[], async (current, use) => {
    const resolved = resolvePlugin(plugins, use, "lint");
    if (!resolved.ok) return resolved;
    const result = await runExternal<readonly Diagnostic[]>(
      use.use,
      () => resolved.value.run(immutableEmissions(emissions), immutablePluginOptions(use), context),
      lintResultSchema,
    );
    if (!result.ok) return result;
    return ok([...current, ...result.value]);
  });
