import { countBy, reduceAsync } from "massaman/array";
import { match } from "massaman/match";

import { acquireApplyLock } from "./apply-lock.ts";
import { createApplyJournal, recoverApplyJournal, writeApplyJournal } from "./apply-journal.ts";
import {
  createAtomicFile,
  removeContainedFile,
  replaceAtomicFile,
  writeAtomicText,
} from "./atomic-file.ts";
import { contentBytes, contentEquals } from "../filesystem/file-content.ts";
import { readOptionalFileRecord } from "../filesystem/file-record.ts";
import { readOptionalText } from "../filesystem/text-file.ts";
import { loadManifest, serializeManifest } from "../planning/manifest.ts";
import { err, ok, type Result } from "../result.ts";
import type { ApplyResult, ApplyWarning } from "./types.ts";
import type { FileContent } from "../artifacts/types.ts";
import type { CoreError } from "../diagnostics/types.ts";
import type { ApplicablePlan, Plan, PlanAction } from "../planning/types.ts";

const rollbackError = (operation: CoreError, rollback: CoreError): Result<never, CoreError> => {
  return err({
    code: "apply",
    message: `${operation.message}; rollback failed: ${rollback.message}`,
  });
};

type ChangedPlanAction = Extract<PlanAction, { readonly action: "create" | "update" | "delete" }>;

const isChangedAction = (action: PlanAction): action is ChangedPlanAction =>
  action.action === "create" || action.action === "update" || action.action === "delete";

const verifyAction = async (
  root: string,
  action: ChangedPlanAction,
): Promise<Result<void, CoreError>> =>
  match(action)
    .with({ action: "create" }, async ({ path }) => verifyContent(root, path, null))
    .with({ action: "update" }, async ({ path, before, beforeMode }) =>
      verifyContent(root, path, before, beforeMode),
    )
    .with({ action: "delete" }, async ({ path, before, beforeMode }) =>
      verifyContent(root, path, before, beforeMode),
    )
    .exhaustive();

const verifyContent = async (
  root: string,
  path: string,
  expected: FileContent | null,
  expectedMode?: number,
): Promise<Result<void, CoreError>> => {
  const current = await readOptionalFileRecord(root, path, "apply");
  if (!current.ok) return current;
  if (current.value === null && expected === null) return ok(undefined);
  if (
    current.value !== null &&
    expected !== null &&
    contentEquals(current.value.content, expected)
  ) {
    if (expectedMode === undefined || current.value.mode === expectedMode) return ok(undefined);
  }
  return err({ code: "apply", message: "Plan is stale; destination changed", path });
};

const applyAction = async (
  root: string,
  action: ChangedPlanAction,
): Promise<Result<void, CoreError>> =>
  match(action)
    .with({ action: "create" }, ({ path, after, afterMode }) =>
      createAtomicFile(root, path, after, afterMode),
    )
    .with({ action: "update" }, ({ path, before, beforeMode, after, afterMode }) =>
      replaceAtomicFile(
        root,
        path,
        { content: contentBytes(before), mode: beforeMode },
        after,
        afterMode,
      ),
    )
    .with({ action: "delete" }, ({ path, before, beforeMode }) =>
      removeContainedFile(root, path, false, {
        content: contentBytes(before),
        mode: beforeMode,
      }),
    )
    .exhaustive();

const verifyPlan = async (plan: ApplicablePlan): Promise<Result<void, CoreError>> => {
  const currentManifest = await loadManifest(plan.root, plan.statePath);
  if (!currentManifest.ok) return err({ ...currentManifest.error, code: "apply" });
  if (JSON.stringify(currentManifest.value) !== JSON.stringify(plan.previousManifest)) {
    return err({
      code: "apply",
      message: "Plan is stale; ownership manifest changed",
      path: plan.statePath,
    });
  }
  return reduceAsync(
    plan.actions.filter(isChangedAction),
    async (result: Result<void, CoreError>, action) => {
      if (!result.ok) return result;
      return verifyAction(plan.root, action);
    },
    ok(undefined) as Result<void, CoreError>,
  );
};

const applyPlanUnlocked = async (plan: ApplicablePlan): Promise<Result<ApplyResult, CoreError>> => {
  const conflict = plan.actions.find((action) => action.action === "conflict");
  if (conflict) {
    return err({ code: "apply", message: conflict.reason, path: conflict.path });
  }
  const recovered = await recoverApplyJournal(plan.root, plan.statePath);
  if (!recovered.ok) return recovered;
  const verified = await verifyPlan(plan);
  if (!verified.ok) return verified;
  const manifestAfter = serializeManifest(plan.manifest);
  const manifestBefore = await readOptionalText(plan.root, plan.statePath, "apply");
  if (!manifestBefore.ok) return manifestBefore;
  const journal = createApplyJournal(plan, manifestBefore.value, manifestAfter);
  const journalWritten = await writeApplyJournal(plan.root, plan.statePath, journal);
  if (!journalWritten.ok) return journalWritten;
  const applied = await reduceAsync(
    plan.actions.filter(isChangedAction),
    async (result: Result<void, CoreError>, action) => {
      if (!result.ok) return result;
      return applyAction(plan.root, action);
    },
    ok(undefined) as Result<void, CoreError>,
  );
  if (!applied.ok) {
    const rollback = await recoverApplyJournal(plan.root, plan.statePath);
    if (!rollback.ok) return rollbackError(applied.error, rollback.error);
    return applied;
  }
  if (manifestBefore.value !== manifestAfter) {
    const manifestWritten = await writeAtomicText(plan.root, plan.statePath, manifestAfter);
    if (!manifestWritten.ok) {
      const rollback = await recoverApplyJournal(plan.root, plan.statePath);
      if (!rollback.ok) return rollbackError(manifestWritten.error, rollback.error);
      return manifestWritten;
    }
  }
  const committed = await writeApplyJournal(plan.root, plan.statePath, {
    ...journal,
    phase: "committed",
  });
  if (!committed.ok) {
    const rollback = await recoverApplyJournal(plan.root, plan.statePath);
    if (!rollback.ok) return rollbackError(committed.error, rollback.error);
    return committed;
  }
  const removed = await removeContainedFile(plan.root, `${plan.statePath}.journal`);
  const counts = countBy(plan.actions, (action) => action.action);
  const result: ApplyResult = {
    created: counts.create ?? 0,
    updated: counts.update ?? 0,
    deleted: counts.delete ?? 0,
    unchanged: counts.noop ?? 0,
  };
  if (removed.ok) return ok(result);
  return ok({
    ...result,
    warnings: [
      {
        code: "journal-cleanup",
        message: removed.error.message,
        path: `${plan.statePath}.journal`,
      },
    ],
  });
};

const withWarnings = (result: ApplyResult, warnings: readonly ApplyWarning[]): ApplyResult => {
  if (warnings.length === 0) return result;
  return { ...result, warnings: [...(result.warnings ?? []), ...warnings] };
};

const applyPlanResult = async (plan: Plan): Promise<Result<ApplyResult, CoreError>> => {
  if (plan.previousManifest === undefined) {
    return err({
      code: "apply",
      message: "Plan is missing its ownership concurrency token",
      path: plan.statePath,
    });
  }
  const applicable: ApplicablePlan = { ...plan, previousManifest: plan.previousManifest };
  const conflict = plan.actions.find((action) => action.action === "conflict");
  if (conflict) return applyPlanUnlocked(applicable);
  const lock = await acquireApplyLock(applicable);
  if (!lock.ok) return lock;
  const result = await applyPlanUnlocked(applicable);
  const cleanupWarnings = await lock.value.release();
  if (!result.ok) return result;
  return ok(withWarnings(result.value, [...lock.value.warnings, ...cleanupWarnings]));
};

export const applyPlan: (plan: Plan) => Promise<Result<ApplyResult, CoreError>> = applyPlanResult;
