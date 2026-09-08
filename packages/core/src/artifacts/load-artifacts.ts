import { basename, dirname, extname, posix } from "node:path";

import { reduceAsync, uniq } from "massaman/array";
import { match } from "massaman/match";

import { parseDocument } from "./parse-document.ts";
import { validateRelativePath } from "../filesystem/contained-path.ts";
import { textContent } from "../filesystem/file-content.ts";
import { err, ok, type Result } from "../result.ts";
import type {
  Artifact,
  ArtifactFile,
  ArtifactKind,
  CoreError,
  FileRecord,
  JsonObject,
  PluginContext,
} from "../types.ts";

const invalidName = (name: string, path: string): CoreError => ({
  code: "source",
  message: `Unsafe artifact name: ${name}`,
  path,
});

const withoutKindPrefix = (path: string, kind: ArtifactKind): string => {
  const prefix = `${kind}/`;
  if (path.startsWith(prefix)) return path.slice(prefix.length);
  return path;
};

const artifactName = (
  kind: ArtifactKind,
  path: string,
  root: string,
  metadata: JsonObject,
): Result<string, CoreError> =>
  match(kind)
    .with("skills", () => {
      const configured = metadata.name;
      const fallback = basename(dirname(path));
      if (configured === undefined) return ok(fallback);
      if (typeof configured !== "string") return err(invalidName(String(configured), path));
      const validated = validateRelativePath(configured, "source");
      if (!validated.ok) return err(invalidName(configured, path));
      return validated;
    })
    .with("rules", "subagents", () => {
      const relative = posix.relative(root, path);
      const withoutExtension = relative.slice(0, -extname(relative).length);
      const name = withoutKindPrefix(withoutExtension, kind);
      const validated = validateRelativePath(name, "source");
      if (!validated.ok) return err(invalidName(name, path));
      return validated;
    })
    .with("instructions", () => ok(basename(path, extname(path))))
    .exhaustive();

const readArtifactRecord = async (
  context: PluginContext,
  path: string,
  primaryPath: string,
  primaryRecord: FileRecord,
): Promise<Result<FileRecord, CoreError>> => {
  if (path === primaryPath) return ok(primaryRecord);
  return context.readFileRecord(path);
};

const loadFiles = async (
  context: PluginContext,
  paths: readonly string[],
  base: string,
  primaryPath: string,
  primaryRecord: FileRecord,
): Promise<Result<readonly ArtifactFile[], CoreError>> => {
  const sorted = uniq(paths).toSorted();
  const loadAt = async (
    index: number,
    current: readonly ArtifactFile[],
  ): Promise<Result<readonly ArtifactFile[], CoreError>> => {
    const path = sorted[index];
    if (path === undefined) return ok(current);
    const relative = posix.relative(base, path);
    const validated = validateRelativePath(relative, "source");
    if (!validated.ok) return validated;
    const record = await readArtifactRecord(context, path, primaryPath, primaryRecord);
    if (!record.ok) return record;
    return loadAt(index + 1, [
      ...current,
      { path: validated.value, content: record.value.content, mode: record.value.mode },
    ]);
  };
  return loadAt(0, []);
};

const resolvedArtifactName = (
  kind: ArtifactKind,
  path: string,
  root: string,
  metadata: JsonObject,
  explicitName: string | undefined,
): Result<string, CoreError> => {
  if (explicitName === undefined) return artifactName(kind, path, root, metadata);
  return validateRelativePath(explicitName, "source");
};

export const loadArtifact = async (
  context: PluginContext,
  kind: ArtifactKind,
  path: string,
  root: string,
  explicitName?: string,
): Promise<Result<Artifact, CoreError>> => {
  const validatedPath = validateRelativePath(path, "source");
  if (!validatedPath.ok) return validatedPath;
  const primary = await context.readFileRecord(path);
  if (!primary.ok) return primary;
  const content = textContent(primary.value.content);
  if (content === null) {
    return err({ code: "source", message: "Artifact Markdown must be UTF-8 text", path });
  }
  const document = parseDocument(path, content);
  if (!document.ok) return document;
  const name = resolvedArtifactName(kind, path, root, document.value.metadata, explicitName);
  if (!name.ok) return name;
  const base = dirname(path);
  const bundledPaths = await match(kind)
    .with("skills", () => context.walk(base))
    .with("instructions", "rules", "subagents", async () => ok([path]))
    .exhaustive();
  if (!bundledPaths.ok) return bundledPaths;
  const files = await loadFiles(context, bundledPaths.value, base, path, primary.value);
  if (!files.ok) return files;
  return ok({
    type: "artifact",
    id: `${kind}:${path}`,
    kind,
    name: name.value,
    source: path,
    content,
    metadata: document.value.metadata,
    files: files.value,
  });
};

export const loadArtifacts = async (
  context: PluginContext,
  root: string,
  kind: ArtifactKind,
  patterns: readonly string[],
): Promise<Result<readonly Artifact[], CoreError>> => {
  const rootedPatterns = patterns.map((pattern) => posix.join(root, pattern));
  const paths = await context.glob(rootedPatterns);
  if (!paths.ok) return paths;
  return reduceAsync(
    uniq(paths.value).toSorted(),
    async (current: Result<readonly Artifact[], CoreError>, path) => {
      if (!current.ok) return current;
      const artifact = await loadArtifact(context, kind, path, root);
      if (!artifact.ok) return artifact;
      return ok([...current.value, artifact.value]);
    },
    ok([]),
  );
};
