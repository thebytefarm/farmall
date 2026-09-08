import { posix } from "node:path";

import { reduceAsync, uniq } from "massaman/array";

import { validateRelativePath } from "../filesystem/contained-path.ts";
import { err, ok, type Result } from "../result.ts";
import type { CoreError, DirectOutput, PluginContext } from "../types.ts";

const outputNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const validateOutputName = (output: string): Result<string, CoreError> => {
  if (outputNamePattern.test(output) && output !== "." && output !== "..") return ok(output);
  return err({ code: "plugin", message: `Invalid output name: ${output}` });
};

export const loadNativeOutputs = async (
  context: PluginContext,
  base: string,
): Promise<Result<readonly DirectOutput[], CoreError>> => {
  const paths = await context.walk(base);
  if (!paths.ok) return paths;
  return reduceAsync(
    uniq(paths.value).toSorted(),
    async (current: Result<readonly DirectOutput[], CoreError>, path) => {
      if (!current.ok) return current;
      const relative = posix.relative(base, path);
      const validatedRelative = validateRelativePath(relative, "source");
      if (!validatedRelative.ok) return validatedRelative;
      const segments = validatedRelative.value.split("/");
      const output = segments.slice(0, 1).join("");
      const fileSegments = segments.slice(1);
      const outputResult = validateOutputName(output);
      if (!outputResult.ok) return outputResult;
      const filePath = fileSegments.join("/");
      const validatedFile = validateRelativePath(filePath, "source");
      if (!validatedFile.ok) return validatedFile;
      const record = await context.readFileRecord(path);
      if (!record.ok) return record;
      return ok([
        ...current.value,
        {
          type: "output",
          id: `output:${path}`,
          output: outputResult.value,
          source: path,
          files: [
            {
              path: validatedFile.value,
              content: record.value.content,
              mode: record.value.mode,
            },
          ],
        },
      ]);
    },
    ok([]),
  );
};
