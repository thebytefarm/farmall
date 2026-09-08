import { groupBy, keyBy, sortBy } from "massaman/array";
import { limitAsync } from "massaman/promise";

import { canonicalizeContainedPath } from "../filesystem/contained-path.ts";
import { digest } from "../filesystem/content-digest.ts";
import { cloneContent, contentEquals } from "../filesystem/file-content.ts";
import { readOptionalFileRecord } from "../filesystem/file-record.ts";
import { reservedStatePaths } from "../filesystem/state-paths.ts";
import { err, ok, type Result } from "../result.ts";
import type { CoreError } from "../diagnostics/types.ts";
import { loadManifest, parseManifestContent } from "./manifest.ts";
import { loadApplyRecoveryState, type ApplyJournal } from "./recovery-state.ts";
import type { ApplicablePlan, DesiredFile, Manifest, ManifestEntry, PlanAction } from "./types.ts";

const pathKey = (path: string): string => `path:${path}`;

interface IndexedDesiredFile {
  readonly file: DesiredFile;
  readonly index: number;
}

interface IndexedPlanError {
  readonly error: CoreError;
  readonly index: number;
}

const normalizeDesiredFile = (
  file: DesiredFile,
  index: number,
): Result<IndexedDesiredFile, IndexedPlanError> => {
  if (
    file.mode !== undefined &&
    (!Number.isInteger(file.mode) || file.mode < 0 || file.mode > 0o7777)
  ) {
    return err({
      error: { code: "plan", message: `Invalid POSIX mode for ${file.path}`, path: file.path },
      index,
    });
  }
  const path = canonicalizeContainedPath(file.path);
  if (!path.ok) return err({ error: path.error, index });
  return ok({
    index,
    file: {
      ...file,
      path: path.value,
      content: cloneContent(file.content),
      sources: [...file.sources],
    },
  });
};

const incompatibleClaim = (claims: readonly IndexedDesiredFile[]): IndexedPlanError | undefined => {
  const first = claims[0] as IndexedDesiredFile;
  const conflict = claims.find(
    ({ file }) =>
      !contentEquals(first.file.content, file.content) ||
      first.file.mode !== file.mode ||
      first.file.writePolicy !== file.writePolicy,
  );
  if (conflict === undefined) return undefined;
  return {
    error: {
      code: "plan",
      message: `Multiple outputs claim ${conflict.file.path}`,
      path: conflict.file.path,
    },
    index: conflict.index,
  };
};

const mergeClaims = (claims: readonly IndexedDesiredFile[]): IndexedDesiredFile => {
  const first = claims[0] as IndexedDesiredFile;
  const last = claims.at(-1) as IndexedDesiredFile;
  return {
    index: last.index,
    file: {
      ...first.file,
      output: claims
        .map(({ file }) => file.output)
        .toSorted()
        .join(","),
      plugin: claims
        .map(({ file }) => file.plugin)
        .toSorted()
        .join(","),
      sources: claims.flatMap(({ file }) => file.sources).toSorted(),
    },
  };
};

const normalizeDesired = (
  desired: readonly DesiredFile[],
): Result<readonly DesiredFile[], CoreError> => {
  const normalized = desired.map(normalizeDesiredFile);
  const valid = normalized.flatMap((result) => {
    if (!result.ok) return [];
    return [result.value];
  });
  const claims = Object.values(groupBy(valid, ({ file }) => pathKey(file.path)));
  const failures = [
    ...normalized.flatMap((result) => {
      if (result.ok) return [];
      return [result.error];
    }),
    ...claims.flatMap((claim) => {
      const conflict = incompatibleClaim(claim);
      if (conflict === undefined) return [];
      return [conflict];
    }),
  ];
  const failure = sortBy(failures, ["index"])[0];
  if (failure !== undefined) return err(failure.error);
  return ok(sortBy(claims.map(mergeClaims), ["index"]).map(({ file }) => file));
};

const desiredConflict = (
  file: DesiredFile,
  reason: string,
  before?: { readonly content: DesiredFile["content"]; readonly mode: number },
): PlanAction => {
  if (before === undefined) {
    return {
      action: "conflict",
      path: file.path,
      output: file.output,
      after: file.content,
      afterMode: file.mode,
      reason,
      desired: file,
    };
  }
  return {
    action: "conflict",
    path: file.path,
    output: file.output,
    before: before.content,
    beforeMode: before.mode,
    after: file.content,
    afterMode: file.mode ?? before.mode,
    reason,
    desired: file,
  };
};

const ownedEntry = (
  claim: ManifestEntry | undefined,
  pipeline: string,
): ManifestEntry | undefined => {
  if (!claim) return undefined;
  if ((claim.pipeline ?? "default") !== pipeline) return undefined;
  return claim;
};

const planDesiredFile = async (
  root: string,
  file: DesiredFile,
  claimsByPath: Readonly<Record<string, ManifestEntry>>,
  pipeline: string,
  recoveryByPath: Readonly<Record<string, ApplyJournal["changes"][number]>> | null,
): Promise<Result<PlanAction, CoreError>> => {
  const current = await readPlannedFile(root, file.path, recoveryByPath);
  if (!current.ok) return current;
  const claim = claimsByPath[pathKey(file.path)];
  const owned = ownedEntry(claim, pipeline);
  if (claim && !owned) {
    return ok(
      desiredConflict(
        file,
        `destination is managed by pipeline ${claim.pipeline ?? "default"}`,
        current.value ?? undefined,
      ),
    );
  }
  if (current.value === null) {
    return ok({
      action: "create",
      path: file.path,
      output: file.output,
      after: file.content,
      afterMode: file.mode,
      desired: file,
    });
  }
  if (file.writePolicy === "create-only") {
    if (
      !contentEquals(current.value.content, file.content) ||
      (file.mode !== undefined && current.value.mode !== file.mode)
    ) {
      return ok(desiredConflict(file, "create-only output already exists", current.value));
    }
    return ok({
      action: "noop",
      path: file.path,
      output: file.output,
      before: current.value.content,
      beforeMode: current.value.mode,
      after: file.content,
      afterMode: file.mode ?? current.value.mode,
      desired: file,
    });
  }
  if (!owned)
    return ok(desiredConflict(file, "destination is not managed by Farmall", current.value));
  if (owned.output !== file.output || owned.plugin !== file.plugin) {
    return ok(desiredConflict(file, "destination is managed by a different output", current.value));
  }
  if (
    contentEquals(current.value.content, file.content) &&
    (file.mode === undefined || current.value.mode === file.mode)
  ) {
    return ok({
      action: "noop",
      path: file.path,
      output: file.output,
      before: current.value.content,
      beforeMode: current.value.mode,
      after: file.content,
      afterMode: file.mode ?? current.value.mode,
      desired: file,
    });
  }
  if (digest(current.value.content) !== owned.digest) {
    return ok(desiredConflict(file, "managed output was edited", current.value));
  }
  return ok({
    action: "update",
    path: file.path,
    output: file.output,
    before: current.value.content,
    beforeMode: current.value.mode,
    after: file.content,
    afterMode: file.mode ?? current.value.mode,
    desired: file,
  });
};

const planStaleEntry = async (
  root: string,
  entry: ManifestEntry,
  recoveryByPath: Readonly<Record<string, ApplyJournal["changes"][number]>> | null,
): Promise<Result<PlanAction, CoreError>> => {
  const current = await readPlannedFile(root, entry.path, recoveryByPath);
  if (!current.ok) return current;
  if (current.value === null) {
    return ok({
      action: "noop",
      path: entry.path,
      output: entry.output,
      reason: "managed output is already absent",
    });
  }
  if (digest(current.value.content) !== entry.digest) {
    return ok({
      action: "conflict",
      path: entry.path,
      output: entry.output,
      before: current.value.content,
      beforeMode: current.value.mode,
      reason: "stale managed output was edited",
    });
  }
  return ok({
    action: "delete",
    path: entry.path,
    output: entry.output,
    before: current.value.content,
    beforeMode: current.value.mode,
  });
};

const planFiles = async <T>(
  files: readonly T[],
  planFile: (file: T) => Promise<Result<PlanAction, CoreError>>,
): Promise<Result<readonly PlanAction[], CoreError>> => {
  const planned = await Promise.all(files.map(limitAsync(planFile, 64)));
  const actions = planned.flatMap((result) => {
    if (!result.ok) return [];
    return [result.value];
  });
  const failure = planned.find((result) => !result.ok);
  if (failure !== undefined && !failure.ok) return failure;
  return ok(actions);
};

const readPlannedFile = async (
  root: string,
  path: string,
  recoveryByPath: Readonly<Record<string, ApplyJournal["changes"][number]>> | null,
): ReturnType<typeof readOptionalFileRecord> => {
  if (recoveryByPath !== null) {
    const change = recoveryByPath[pathKey(path)];
    if (change) {
      if (change.before === null) return ok(null);
      const mode = change.before.mode ?? 0o666;
      return ok({ content: new Uint8Array(Buffer.from(change.before.content)), mode });
    }
  }
  return readOptionalFileRecord(root, path);
};

const loadPlanningManifest = async (
  root: string,
  statePath: string,
  journal: ApplyJournal | null,
): Promise<Result<Manifest, CoreError>> => {
  if (journal?.phase === "applying") {
    return parseManifestContent(root, statePath, journal.manifestBefore);
  }
  return loadManifest(root, statePath);
};

const indexRecoveryChanges = (
  journal: ApplyJournal | null,
): Readonly<Record<string, ApplyJournal["changes"][number]>> | null => {
  if (journal?.phase !== "applying") return null;
  return keyBy(journal.changes, (change) => pathKey(change.path));
};

export const createPlan = async (
  root: string,
  statePath: string,
  desired: readonly DesiredFile[],
  pipeline = "default",
): Promise<Result<ApplicablePlan, CoreError>> => {
  const safeState = canonicalizeContainedPath(statePath);
  if (!safeState.ok) return safeState;
  const normalized = normalizeDesired(desired);
  if (!normalized.ok) return normalized;
  const reserved = reservedStatePaths(safeState.value);
  const reservedByPath = keyBy(reserved, pathKey);
  const collision = normalized.value.find(
    (file) => reservedByPath[pathKey(file.path)] !== undefined,
  );
  if (collision) {
    return err({
      code: "plan",
      message: "An output collides with Farmall apply state",
      path: collision.path,
    });
  }
  const journal = await loadApplyRecoveryState(root, safeState.value);
  if (!journal.ok) return journal;
  const manifest = await loadPlanningManifest(root, safeState.value, journal.value);
  if (!manifest.ok) return manifest;
  const claimsByPath = keyBy(manifest.value.entries, (entry) => pathKey(entry.path));
  const recoveryByPath = indexRecoveryChanges(journal.value);
  const desiredActions = await planFiles(normalized.value, (file) =>
    planDesiredFile(root, file, claimsByPath, pipeline, recoveryByPath),
  );
  if (!desiredActions.ok) return desiredActions;
  const desiredByPath = keyBy(normalized.value, (file) => pathKey(file.path));
  const stale = manifest.value.entries.filter(
    (entry) =>
      (entry.pipeline ?? "default") === pipeline &&
      desiredByPath[pathKey(entry.path)] === undefined,
  );
  const staleActions = await planFiles(stale, (entry) =>
    planStaleEntry(root, entry, recoveryByPath),
  );
  if (!staleActions.ok) return staleActions;
  const entries = [
    ...manifest.value.entries.filter((entry) => (entry.pipeline ?? "default") !== pipeline),
    ...normalized.value
      .filter((file) => file.writePolicy === "managed")
      .map((file) => ({
        path: file.path,
        pipeline,
        output: file.output,
        plugin: file.plugin,
        sources: file.sources,
        digest: digest(file.content),
      })),
  ];
  return ok({
    root,
    statePath: safeState.value,
    pipeline,
    previousManifest: manifest.value,
    actions: sortBy([...desiredActions.value, ...staleActions.value], ["path"]),
    manifest: { version: 1, entries: sortBy(entries, ["path"]) },
  });
};
