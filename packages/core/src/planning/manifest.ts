import { groupBy, sortBy } from "massaman/array";
import { limitAsync } from "massaman/promise";
import { z } from "zod";

import { canonicalizeContainedPath, resolveContainedPath } from "../filesystem/contained-path.ts";
import { isReservedStatePath } from "../filesystem/state-paths.ts";
import { readOptionalText } from "../filesystem/text-file.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import type { CoreError } from "../diagnostics/types.ts";
import type { Manifest, ManifestEntry } from "./types.ts";

export const EMPTY_MANIFEST: Manifest = { version: 1, entries: [] };

const pathKey = (path: string): string => `path:${path}`;

interface IndexedManifestEntry {
  readonly entry: ManifestEntry;
  readonly index: number;
}

interface IndexedManifestError {
  readonly error: CoreError;
  readonly index: number;
}

const manifestEntrySchema = z
  .object({
    path: z.string(),
    pipeline: z.string().min(1).optional(),
    output: z.string().min(1),
    plugin: z.string().min(1),
    sources: z.array(z.string()),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const manifestSchema = z
  .object({ version: z.literal(1), entries: z.array(manifestEntrySchema) })
  .strict();

type ParsedManifestEntry = z.infer<typeof manifestEntrySchema>;

const normalizeManifestEntry = async (
  root: string,
  statePath: string,
  entry: ParsedManifestEntry,
  index: number,
): Promise<Result<IndexedManifestEntry, IndexedManifestError>> => {
  const canonical = canonicalizeContainedPath(entry.path);
  if (!canonical.ok) return err({ error: canonical.error, index });
  if (isReservedStatePath(statePath, canonical.value)) {
    return err({
      error: {
        code: "plan",
        message: "Ownership entry collides with Farmall apply state",
        path: canonical.value,
      },
      index,
    });
  }
  const safe = await resolveContainedPath(root, canonical.value);
  if (!safe.ok) return err({ error: safe.error, index });
  if (entry.pipeline === undefined) {
    return ok({
      index,
      entry: {
        path: canonical.value,
        output: entry.output,
        plugin: entry.plugin,
        sources: entry.sources,
        digest: entry.digest,
      },
    });
  }
  return ok({
    index,
    entry: {
      path: canonical.value,
      pipeline: entry.pipeline,
      output: entry.output,
      plugin: entry.plugin,
      sources: entry.sources,
      digest: entry.digest,
    },
  });
};

export const serializeManifest = (manifest: Manifest): string =>
  `${JSON.stringify(manifest, null, 2)}\n`;

export const parseManifestContent = async (
  root: string,
  statePath: string,
  content: string | null,
): Promise<Result<Manifest, CoreError>> => {
  if (content === null) return ok(EMPTY_MANIFEST);
  try {
    const parsed = manifestSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      return err({ code: "plan", message: "Invalid Farmall state manifest", path: statePath });
    }
    const normalizeEntry = limitAsync(
      (entry: ParsedManifestEntry, index: number) =>
        normalizeManifestEntry(root, statePath, entry, index),
      64,
    );
    const normalized = await Promise.all(parsed.data.entries.map(normalizeEntry));
    const valid = normalized.flatMap((result) => {
      if (!result.ok) return [];
      return [result.value];
    });
    const claims = Object.values(groupBy(valid, ({ entry }) => pathKey(entry.path)));
    const failures = [
      ...normalized.flatMap((result) => {
        if (result.ok) return [];
        return [result.error];
      }),
      ...claims.flatMap((claim) =>
        claim.slice(1).map(({ entry, index }) => ({
          error: {
            code: "plan" as const,
            message: "Duplicate ownership entry path",
            path: entry.path,
          },
          index,
        })),
      ),
    ];
    const failure = sortBy(failures, ["index"])[0];
    if (failure !== undefined) return err(failure.error);
    return ok({ version: 1, entries: valid.map(({ entry }) => entry) });
  } catch (error) {
    return err({ code: "plan", message: errorMessage(error), path: statePath });
  }
};

export const loadManifest = async (
  root: string,
  statePath: string,
): Promise<Result<Manifest, CoreError>> => {
  const canonical = canonicalizeContainedPath(statePath);
  if (!canonical.ok) return canonical;
  const content = await readOptionalText(root, canonical.value);
  if (!content.ok) return content;
  return parseManifestContent(root, canonical.value, content.value);
};
