import { basename, extname, posix } from "node:path";

import { reduceAsync, uniq } from "massaman/array";
import { match } from "massaman/match";
import { z } from "zod";

import { loadArtifact } from "../artifacts/load-artifacts.ts";
import { validateRelativePath } from "../filesystem/contained-path.ts";
import { err, ok, type Result } from "../result.ts";
import {
  ARTIFACT_KINDS,
  type Artifact,
  type ArtifactKind,
  type CoreError,
  type PluginContext,
  type SourcePlugin,
} from "../types.ts";
import { PLATFORM_IDS, platformDefinition } from "./platform-definitions.ts";

const rootSchema = z
  .string()
  .min(1)
  .refine((root) => validateRelativePath(root, "plugin", true).ok);
const platformSourceOptionsSchema = z
  .object({
    platform: z.enum(PLATFORM_IDS),
    root: rootSchema.optional().default("."),
  })
  .strict();

type PlatformSourceOptions = z.infer<typeof platformSourceOptionsSchema>;

const optionError = (message: string): CoreError => ({
  code: "plugin",
  message: `Invalid farmall:platform-source options: ${message}`,
  plugin: "farmall:platform-source",
});

const parseOptions = (
  options: Readonly<Record<string, unknown>>,
): Result<PlatformSourceOptions, CoreError> => {
  const parsed = platformSourceOptionsSchema.safeParse(options);
  if (!parsed.success) return err(optionError(z.prettifyError(parsed.error)));
  return ok(parsed.data);
};

const patternFor = (kind: ArtifactKind, template: string): string =>
  match(kind)
    .with("skills", () => template.replace("{name}", "**").replace("{file}", "SKILL.md"))
    .with("instructions", "rules", "subagents", () => template.replace("{name}", "**/*"))
    .exhaustive();

const rootedPath = (root: string, path: string): string => {
  if (root === ".") return path;
  return posix.join(root, path);
};

const relativeToRoot = (root: string, path: string): string => {
  if (root === ".") return path;
  return posix.relative(root, path);
};

const explicitArtifactName = (kind: ArtifactKind, name: string): string | undefined => {
  if (kind === "skills") return undefined;
  return name;
};

const nameFor = (kind: ArtifactKind, template: string, path: string): Result<string, CoreError> => {
  const marker = template.indexOf("{name}");
  if (marker < 0) return ok(basename(path, extname(path)));
  const prefix = template.slice(0, marker);
  const suffix = template.slice(marker + "{name}".length).replace("{file}", "SKILL.md");
  const name = path.slice(prefix.length, path.length - suffix.length);
  return validateRelativePath(name, "source");
};

const loadPlatformKind = async (
  context: PluginContext,
  root: string,
  kind: ArtifactKind,
  template: string,
  claimedPaths: readonly string[],
): Promise<Result<readonly Artifact[], CoreError>> => {
  const relativePattern = patternFor(kind, template);
  const pattern = rootedPath(root, relativePattern);
  const paths = await context.glob(pattern);
  if (!paths.ok) return paths;
  return reduceAsync(
    uniq(paths.value)
      .filter((path) => !claimedPaths.includes(path))
      .toSorted(),
    async (current: Result<readonly Artifact[], CoreError>, path) => {
      if (!current.ok) return current;
      const relative = relativeToRoot(root, path);
      const name = nameFor(kind, template, relative);
      if (!name.ok) return name;
      const explicitName = explicitArtifactName(kind, name.value);
      const artifact = await loadArtifact(context, kind, path, root, explicitName);
      if (!artifact.ok) return artifact;
      if (kind !== "skills") return ok([...current.value, artifact.value]);
      const nestedName = name.value;
      return ok([...current.value, { ...artifact.value, name: nestedName }]);
    },
    ok([]),
  );
};

export const platformSourcePlugin: SourcePlugin = {
  apiVersion: 1,
  id: "farmall:platform-source",
  kind: "source",
  validate: (options) => {
    const parsed = parseOptions(options);
    if (!parsed.ok) return parsed;
    return ok(undefined);
  },
  run: async (options, context) => {
    const parsed = parseOptions(options);
    if (!parsed.ok) return parsed;
    const definition = platformDefinition(parsed.value.platform);
    const artifacts = await reduceAsync(
      ARTIFACT_KINDS,
      async (current: Result<readonly Artifact[], CoreError>, kind) => {
        if (!current.ok) return current;
        const template = definition.paths[kind];
        if (template === false) return current;
        const loaded = await loadPlatformKind(
          context,
          parsed.value.root,
          kind,
          template,
          current.value.map((artifact) => artifact.source),
        );
        if (!loaded.ok) return loaded;
        return ok([...current.value, ...loaded.value]);
      },
      ok([]),
    );
    if (!artifacts.ok) return artifacts;
    return ok({ value: artifacts.value, diagnostics: [] });
  },
};

export const platformSource = platformSourcePlugin;
