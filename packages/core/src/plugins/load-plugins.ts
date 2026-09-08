import { randomUUID } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createJiti } from "jiti";
import { countBy, reduceAsync } from "massaman/array";
import { isMatching, P } from "massaman/match";

import type { CoreError } from "../diagnostics/types.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import type { FarmallPlugin } from "./types.ts";

const pluginPattern = {
  apiVersion: 1,
  id: P.string,
  kind: P.union("source", "transform", "lint", "output"),
  run: P.when((run) => typeof run === "function"),
};

const isPlugin = (value: unknown): value is FarmallPlugin => isMatching(pluginPattern, value);

const exportedValues = (value: unknown): readonly unknown[] => {
  if (Array.isArray(value)) return value;
  return [value];
};

const modulePlugins = (module: Readonly<Record<string, unknown>>): readonly FarmallPlugin[] =>
  [...exportedValues(module.default), ...exportedValues(module.plugins)].filter(isPlugin);

const pluginTarget = (specifier: string): string => {
  if (isAbsolute(specifier)) return pathToFileURL(specifier).href;
  return specifier;
};

const importPlugins = async (
  root: string,
  specifier: string,
): Promise<Result<readonly FarmallPlugin[], CoreError>> => {
  try {
    const importer = createJiti(pathToFileURL(resolve(root, "farmall.config.mjs")).href, {
      interopDefault: false,
      moduleCache: false,
    });
    const target = pluginTarget(specifier);
    const resolvedTarget = importer.esmResolve(target, {
      conditions: ["node", "import"],
    });
    const moduleUrl = `${resolvedTarget}?farmall=${randomUUID()}`;
    const loadedModule = (await import(moduleUrl)) as Readonly<Record<string, unknown>>;
    const plugins = modulePlugins(loadedModule);
    if (plugins.length > 0) return ok(plugins);
    return err({
      code: "plugin",
      message: "Module exports no Farmall plugins",
      plugin: specifier,
    });
  } catch (error) {
    return err({ code: "plugin", message: errorMessage(error), plugin: specifier });
  }
};

export const loadPlugins = async (
  root: string,
  builtins: readonly FarmallPlugin[],
  modules: readonly string[],
): Promise<Result<readonly FarmallPlugin[], CoreError>> => {
  const loaded = await reduceAsync(
    modules,
    async (current: Result<readonly FarmallPlugin[], CoreError>, specifier) => {
      if (!current.ok) return current;
      const imported = await importPlugins(root, specifier);
      if (!imported.ok) return imported;
      return ok([...current.value, ...imported.value]);
    },
    ok(builtins),
  );
  if (!loaded.ok) return loaded;
  const idCounts = countBy(loaded.value, (plugin) => plugin.id);
  const duplicate = loaded.value.find((plugin) => idCounts[plugin.id]! > 1);
  if (!duplicate) return loaded;
  return err({
    code: "plugin",
    message: `Duplicate plugin id: ${duplicate.id}`,
    plugin: duplicate.id,
  });
};
