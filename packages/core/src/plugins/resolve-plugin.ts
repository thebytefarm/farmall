import type { CoreError } from "../diagnostics/types.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import { immutableClone } from "./immutable.ts";
import { validationResultSchema } from "./result-schemas.ts";
import type { FarmallPlugin, PluginKind, PluginUse } from "./types.ts";

export const immutablePluginOptions = (use: PluginUse): Readonly<Record<string, unknown>> => {
  const namedOptions = { ...use.options };
  if (use.name === undefined) return immutableClone(namedOptions);
  return immutableClone({ ...namedOptions, output: use.name });
};

export const resolvePlugin = <K extends PluginKind>(
  plugins: readonly FarmallPlugin[],
  use: PluginUse,
  kind: K,
): Result<Extract<FarmallPlugin, { readonly kind: K }>, CoreError> => {
  const plugin = plugins.find(
    (candidate): candidate is Extract<FarmallPlugin, { readonly kind: K }> =>
      candidate.id === use.use && candidate.kind === kind,
  );
  if (plugin === undefined) {
    const identified = plugins.find((candidate) => candidate.id === use.use);
    if (identified !== undefined) {
      return err({
        code: "plugin",
        message: `Plugin ${use.use} is ${identified.kind}, expected ${kind}`,
        plugin: use.use,
      });
    }
    return err({ code: "plugin", message: `Unknown plugin: ${use.use}`, plugin: use.use });
  }
  try {
    if (!plugin.validate) return ok(plugin);
    const validation = validationResultSchema.safeParse(
      plugin.validate(immutablePluginOptions(use)),
    );
    if (!validation.success) {
      return err({
        code: "plugin",
        message: `Invalid validation result from ${plugin.id}`,
        plugin: plugin.id,
      });
    }
    const immutableValidation = immutableClone(validation.data);
    if (!immutableValidation.ok) return err(immutableValidation.error);
    return ok(plugin);
  } catch (error) {
    return err({ code: "plugin", message: errorMessage(error), plugin: use.use });
  }
};
