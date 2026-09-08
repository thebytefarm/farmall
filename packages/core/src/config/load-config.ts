import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import { createJiti } from "jiti";
import { reduceAsync } from "massaman/array";
import { isMatching, P } from "massaman/match";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

import type { CoreError } from "../diagnostics/types.ts";
import type { FarmallConfig, ResolvedConfig } from "../pipeline/types.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import { farmallConfigSchema } from "./schema.ts";

const CONFIG_NAMES = [
  "farmall.config.ts",
  "farmall.config.js",
  "farmall.config.mjs",
  "farmall.config.json",
  "farmall.config.jsonc",
  "farmall.config.yaml",
  "farmall.config.yml",
] as const;

const discoverPath = async (
  directory: string,
  name: string,
): Promise<Result<string | null, CoreError>> => {
  const path = join(directory, name);
  try {
    await access(path);
    return ok(path);
  } catch (error) {
    if (isMatching({ code: P.string }, error) && error.code === "ENOENT") return ok(null);
    return err({ code: "config", message: errorMessage(error), path });
  }
};

const findConfigDirectory = async (
  directory: string,
): Promise<
  Result<{ readonly directory: string; readonly paths: readonly string[] }, CoreError>
> => {
  const discovered = await reduceAsync(
    CONFIG_NAMES,
    async (current: Result<readonly string[], CoreError>, name) => {
      if (!current.ok) return current;
      const candidate = await discoverPath(directory, name);
      if (!candidate.ok) return candidate;
      if (candidate.value === null) return current;
      return ok([...current.value, candidate.value]);
    },
    ok([]),
  );
  if (!discovered.ok) return discovered;
  if (discovered.value.length > 0) return ok({ directory, paths: discovered.value });
  const parent = dirname(directory);
  if (parent === directory) {
    return err({ code: "config", message: "No Farmall config found", path: directory });
  }
  return findConfigDirectory(parent);
};

const parseJsonc = (content: string): Result<unknown, CoreError> => {
  const errors: ParseError[] = [];
  const value: unknown = parse(content, errors, { allowTrailingComma: true });
  const parseError = errors[0];
  if (!parseError) return ok(value);
  return err({
    code: "config",
    message: `${printParseErrorCode(parseError.error)} at offset ${parseError.offset}`,
  });
};

const loadModuleValue = async (path: string): Promise<unknown> => {
  const importer = createJiti(pathToFileURL(path).href, {
    interopDefault: false,
    moduleCache: false,
  });
  const source = await readFile(path, "utf8");
  const moduleId = `${path}.farmall-${randomUUID()}${extname(path)}`;
  const loaded = (await importer.evalModule(source, {
    async: true,
    cache: {},
    filename: moduleId,
    id: moduleId,
  })) as Readonly<Record<string, unknown>>;
  if ("default" in loaded) return loaded.default;
  return loaded;
};

const loadConfigValue = async (path: string): Promise<Result<unknown, CoreError>> => {
  const extension = extname(path);
  if (extension === ".yaml" || extension === ".yml") {
    return ok(parseYaml(await readFile(path, "utf8")));
  }
  if (extension === ".json") return ok(JSON.parse(await readFile(path, "utf8")) as unknown);
  if (extension !== ".jsonc") return ok(await loadModuleValue(path));
  const parsed = parseJsonc(await readFile(path, "utf8"));
  if (parsed.ok) return parsed;
  return err({ ...parsed.error, path });
};

const selectConfig = async (
  cwd: string,
  explicitPath: string | undefined,
): Promise<
  Result<{ readonly directory: string; readonly paths: readonly string[] }, CoreError>
> => {
  if (explicitPath === undefined) return findConfigDirectory(resolve(cwd));
  const path = resolve(cwd, explicitPath);
  return ok({ directory: dirname(path), paths: [path] });
};

export const selectConfigPath = (
  selected: Readonly<{ directory: string; paths: readonly string[] }>,
): Result<string, CoreError> => {
  const path = selected.paths[0];
  if (path === undefined) {
    return err({ code: "config", message: "No Farmall config found", path: selected.directory });
  }
  if (selected.paths.length > 1) {
    return err({
      code: "config",
      message: `Multiple Farmall configs found: ${selected.paths.join(", ")}`,
      path: selected.directory,
    });
  }
  return ok(path);
};

export const loadConfig = async (
  cwd: string,
  explicitPath?: string,
): Promise<Result<ResolvedConfig, CoreError>> => {
  const selected = await selectConfig(cwd, explicitPath);
  if (!selected.ok) return selected;
  const selectedPath = selectConfigPath(selected.value);
  if (!selectedPath.ok) return selectedPath;
  const path = selectedPath.value;
  try {
    const loaded = await loadConfigValue(path);
    if (!loaded.ok) return loaded;
    const parsed = farmallConfigSchema.safeParse(loaded.value);
    if (!parsed.success)
      return err({ code: "config", message: z.prettifyError(parsed.error), path });
    return ok({ path, root: dirname(path), config: parsed.data as FarmallConfig });
  } catch (error) {
    return err({ code: "config", message: errorMessage(error), path });
  }
};
