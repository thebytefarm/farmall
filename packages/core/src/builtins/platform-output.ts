import { basename, posix } from "node:path";

import { match } from "massaman/match";
import { mapValues } from "massaman/object";
import { z } from "zod";

import { validateOutputName } from "../artifacts/load-native-outputs.ts";
import { validateRelativePath } from "../filesystem/contained-path.ts";
import { err, ok, type Result } from "../result.ts";
import {
  type Artifact,
  type ArtifactFile,
  type CoreError,
  type DesiredFile,
  type Diagnostic,
  type Emission,
  type OutputPlugin,
  type WritePolicy,
} from "../types.ts";
import {
  FILESYSTEM_DEFINITION,
  type OutputPaths,
  type PlatformDefinition,
} from "./platform-definitions.ts";

const templatePath = z
  .string()
  .min(1)
  .refine((template) => {
    const rendered = template
      .replaceAll("{name}", "name")
      .replaceAll("{path}", "path")
      .replaceAll("{file}", "file");
    return validateRelativePath(rendered, "plugin").ok;
  });
const pathsSchema = z
  .object({
    instructions: z.union([templatePath, z.literal(false)]).optional(),
    rules: z.union([templatePath, z.literal(false)]).optional(),
    skills: z.union([templatePath, z.literal(false)]).optional(),
    subagents: z.union([templatePath, z.literal(false)]).optional(),
  })
  .strict();
const outputOptionsSchema = z
  .object({
    output: z
      .string()
      .min(1)
      .refine((output) => validateOutputName(output).ok)
      .optional(),
    root: z
      .string()
      .min(1)
      .refine((root) => validateRelativePath(root, "plugin", true).ok)
      .optional(),
    writePolicy: z.enum(["managed", "create-only"]).optional(),
    paths: pathsSchema.optional(),
  })
  .strict();

interface ResolvedOutputOptions {
  readonly output: string;
  readonly root: string;
  readonly writePolicy: WritePolicy;
  readonly paths: OutputPaths;
}

const defaulted = <T>(value: T | undefined, fallback: T): T => {
  if (value === undefined) return fallback;
  return value;
};

const optionError = (id: string, message: string): CoreError => ({
  code: "plugin",
  message: `Invalid farmall:${id} options: ${message}`,
  plugin: `farmall:${id}`,
});

const parseOptions = (
  definition: PlatformDefinition,
  defaultRoot: string,
  options: Readonly<Record<string, unknown>>,
): Result<ResolvedOutputOptions, CoreError> => {
  const parsed = outputOptionsSchema.safeParse(options);
  if (!parsed.success) return err(optionError(definition.id, z.prettifyError(parsed.error)));
  const paths = mapValues(definition.paths, (fallback, kind) => {
    const configured = parsed.data.paths?.[kind];
    if (configured === undefined) return fallback;
    return configured;
  });
  const output = defaulted(parsed.data.output, definition.id);
  const root = defaulted(parsed.data.root, defaultRoot);
  const writePolicy = defaulted<WritePolicy>(parsed.data.writePolicy, "managed");
  return ok({ output, root, writePolicy, paths });
};

const rootedPath = (root: string, path: string): string => {
  if (root === ".") return path;
  return posix.join(root, path);
};

const renderPath = (
  template: string,
  artifact: Artifact,
  file: ArtifactFile,
): Result<string, CoreError> => {
  const name = validateRelativePath(artifact.name, "plugin");
  if (!name.ok) return name;
  const source = validateRelativePath(artifact.source, "plugin");
  if (!source.ok) return source;
  const filePath = validateRelativePath(file.path, "plugin");
  if (!filePath.ok) return filePath;
  return validateRelativePath(
    template
      .replaceAll("{name}", name.value)
      .replaceAll("{path}", source.value)
      .replaceAll("{file}", filePath.value),
    "plugin",
  );
};

const desiredArtifactFiles = (
  artifact: Artifact,
  options: ResolvedOutputOptions,
  plugin: string,
): Result<readonly DesiredFile[], CoreError> => {
  const template = options.paths[artifact.kind];
  if (template === false) return ok([]);
  const files = match(artifact.kind)
    .with("skills", () => artifact.files)
    .with("instructions", "rules", "subagents", () => [
      {
        path: basename(artifact.source),
        content: artifact.content,
        mode: artifact.files[0]?.mode,
      },
    ])
    .exhaustive();
  return files.reduce<Result<readonly DesiredFile[], CoreError>>((current, file) => {
    if (!current.ok) return current;
    const rendered = renderPath(template, artifact, file);
    if (!rendered.ok) return rendered;
    const path = rootedPath(options.root, rendered.value);
    return ok([
      ...current.value,
      {
        path,
        content: file.content,
        mode: file.mode,
        output: options.output,
        plugin,
        sources: [artifact.id],
        writePolicy: options.writePolicy,
      },
    ]);
  }, ok([]));
};

const desiredDirectFiles = (
  emission: Extract<Emission, { readonly type: "output" }>,
  options: ResolvedOutputOptions,
  plugin: string,
): Result<readonly DesiredFile[], CoreError> =>
  emission.files.reduce<Result<readonly DesiredFile[], CoreError>>((current, file) => {
    if (!current.ok) return current;
    const filePath = validateRelativePath(file.path, "plugin");
    if (!filePath.ok) return filePath;
    const path = rootedPath(options.root, filePath.value);
    return ok([
      ...current.value,
      {
        path,
        content: file.content,
        mode: file.mode,
        output: options.output,
        plugin,
        sources: [emission.id],
        writePolicy: options.writePolicy,
      },
    ]);
  }, ok([]));

export const createPlatformOutputPlugin = (
  definition: PlatformDefinition,
  defaultRoot = ".",
): OutputPlugin => ({
  apiVersion: 1,
  id: `farmall:${definition.id}`,
  kind: "output",
  validate: (options) => {
    const parsed = parseOptions(definition, defaultRoot, options);
    if (!parsed.ok) return parsed;
    return ok(undefined);
  },
  run: async (emissions, rawOptions) => {
    const options = parseOptions(definition, defaultRoot, rawOptions);
    if (!options.ok) return options;
    const plugin = `farmall:${definition.id}`;
    const diagnostics = emissions.flatMap((emission): readonly Diagnostic[] =>
      match(emission)
        .with({ type: "output" }, () => [])
        .with({ type: "artifact" }, (artifact) => {
          if (options.value.paths[artifact.kind] !== false) return [];
          return [
            {
              rule: "farmall/unsupported-artifact",
              severity: "warn",
              message: `${definition.id} does not support ${artifact.kind}`,
              artifactId: artifact.id,
              path: artifact.source,
              plugin,
            } satisfies Diagnostic,
          ];
        })
        .exhaustive(),
    );
    const desired = emissions.reduce<Result<readonly DesiredFile[], CoreError>>(
      (current, emission) => {
        if (!current.ok) return current;
        const files = match(emission)
          .with({ type: "artifact" }, (artifact) =>
            desiredArtifactFiles(artifact, options.value, plugin),
          )
          .with({ type: "output" }, (direct) => {
            const output = validateOutputName(direct.output);
            if (!output.ok) return output;
            if (output.value !== options.value.output) return ok([]);
            return desiredDirectFiles(direct, options.value, plugin);
          })
          .exhaustive();
        if (!files.ok) return files;
        return ok([...current.value, ...files.value]);
      },
      ok([]),
    );
    if (!desired.ok) return desired;
    return ok({ value: desired.value, diagnostics });
  },
});

export const filesystemOutputPlugin = createPlatformOutputPlugin(
  FILESYSTEM_DEFINITION,
  "agent-config",
);
export const filesystemOutput = filesystemOutputPlugin;
