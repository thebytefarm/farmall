import { posix } from "node:path";

import { reduceAsync } from "massaman/array";
import { mapValues } from "massaman/object";
import { z } from "zod";

import { loadArtifacts } from "../artifacts/load-artifacts.ts";
import { loadNativeOutputs } from "../artifacts/load-native-outputs.ts";
import { validateRelativePath } from "../filesystem/contained-path.ts";
import { err, ok, type Result } from "../result.ts";
import {
  ARTIFACT_KINDS,
  type Artifact,
  type ArtifactKind,
  type CoreError,
  type SourcePlugin,
} from "../types.ts";

const DEFAULT_PATTERNS: Readonly<Record<ArtifactKind, readonly string[]>> = {
  instructions: ["AGENTS.md"],
  rules: ["rules/**/*.md"],
  skills: ["skills/**/SKILL.md"],
  subagents: ["subagents/**/*.md"],
};

const relativePath = z
  .string()
  .min(1)
  .refine((path) => validateRelativePath(path, "plugin").ok);
const rootPath = z
  .string()
  .min(1)
  .refine((path) => validateRelativePath(path, "plugin", true).ok);
const patternsSchema = z
  .object({
    instructions: z.array(relativePath).optional(),
    rules: z.array(relativePath).optional(),
    skills: z.array(relativePath).optional(),
    subagents: z.array(relativePath).optional(),
  })
  .strict();
const filesystemSourceOptionsSchema = z
  .object({
    root: rootPath.optional().default("agent-config"),
    patterns: patternsSchema.optional(),
    outputs: z
      .union([relativePath, z.literal(false)])
      .optional()
      .default("outputs"),
  })
  .strict();

type FilesystemSourceOptions = z.infer<typeof filesystemSourceOptionsSchema>;

const optionError = (message: string): CoreError => ({
  code: "plugin",
  message: `Invalid farmall:source options: ${message}`,
  plugin: "farmall:source",
});

const parseOptions = (
  options: Readonly<Record<string, unknown>>,
): Result<FilesystemSourceOptions, CoreError> => {
  const parsed = filesystemSourceOptionsSchema.safeParse(options);
  if (!parsed.success) return err(optionError(z.prettifyError(parsed.error)));
  return ok(parsed.data);
};

const configuredPatterns = (
  patterns: FilesystemSourceOptions["patterns"],
): Readonly<Record<ArtifactKind, readonly string[]>> =>
  mapValues(DEFAULT_PATTERNS, (defaults, kind) => {
    if (patterns === undefined) return defaults;
    const configured = patterns[kind];
    if (configured === undefined) return defaults;
    return configured;
  });

export const filesystemSourcePlugin: SourcePlugin = {
  apiVersion: 1,
  id: "farmall:source",
  kind: "source",
  validate: (options) => {
    const parsed = parseOptions(options);
    if (!parsed.ok) return parsed;
    return ok(undefined);
  },
  run: async (options, context) => {
    const parsed = parseOptions(options);
    if (!parsed.ok) return parsed;
    const patterns = configuredPatterns(parsed.value.patterns);
    const artifacts = await reduceAsync(
      ARTIFACT_KINDS,
      async (current: Result<readonly Artifact[], CoreError>, kind) => {
        if (!current.ok) return current;
        const loaded = await loadArtifacts(context, parsed.value.root, kind, patterns[kind]);
        if (!loaded.ok) return loaded;
        return ok([...current.value, ...loaded.value]);
      },
      ok([]),
    );
    if (!artifacts.ok) return artifacts;
    if (parsed.value.outputs === false) {
      return ok({ value: artifacts.value, diagnostics: [] });
    }
    const direct = await loadNativeOutputs(
      context,
      posix.join(parsed.value.root, parsed.value.outputs),
    );
    if (!direct.ok) return direct;
    return ok({ value: [...artifacts.value, ...direct.value], diagnostics: [] });
  },
};

export const filesystemSource = filesystemSourcePlugin;
