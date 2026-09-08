import { reduceAsync } from "massaman/array";
import { match } from "massaman/match";

import {
  createAtomicFile,
  removeContainedFile,
  replaceAtomicFile,
  writeAtomicText,
} from "./atomic-file.ts";
import { contentEquals } from "../filesystem/file-content.ts";
import { readOptionalFileRecord } from "../filesystem/file-record.ts";
import { readOptionalText } from "../filesystem/text-file.ts";
import {
  journalPathFor,
  loadApplyRecoveryState,
  serializeApplyJournal,
  type ApplyJournal,
  type JournalChange,
  type JournalFile,
} from "../planning/recovery-state.ts";
import { err, ok, type Result } from "../result.ts";
import type { FileContent, FileRecord, PosixMode } from "../artifacts/types.ts";
import type { CoreError } from "../diagnostics/types.ts";
import type { Plan, PlanAction } from "../planning/types.ts";

export { journalPathFor, loadApplyRecoveryState as loadApplyJournal };
export type { ApplyJournal, JournalChange, JournalFile };

const journalFile = (content: FileContent, mode?: PosixMode): JournalFile => ({ content, mode });
const modeJournalFile = (
  content: FileContent,
  mode: PosixMode,
): JournalFile & { mode: PosixMode } => ({
  content,
  mode,
});

const requiredModeJournalFile = (
  content: FileContent,
  mode: PosixMode | undefined,
): JournalFile & { mode: PosixMode } => {
  if (mode === undefined) throw new TypeError("Mutating plan action is missing a POSIX mode");
  return modeJournalFile(content, mode);
};

const actionChange = (action: PlanAction): JournalChange | null =>
  match(action)
    .with({ action: "create" }, ({ path, after, afterMode }) => ({
      action: "create" as const,
      path,
      before: null,
      after: journalFile(after, afterMode),
    }))
    .with({ action: "update" }, ({ path, before, after, beforeMode, afterMode }) => ({
      action: "update" as const,
      path,
      before: modeJournalFile(before, beforeMode),
      after: requiredModeJournalFile(after, afterMode),
    }))
    .with({ action: "delete" }, ({ path, before, beforeMode }) => ({
      action: "delete" as const,
      path,
      before: modeJournalFile(before, beforeMode),
      after: null,
    }))
    .with({ action: "noop" }, () => null)
    .with({ action: "conflict" }, () => null)
    .exhaustive();

export const createApplyJournal = (
  plan: Plan,
  manifestBefore: string | null,
  manifestAfter: string,
): ApplyJournal => ({
  version: 2,
  phase: "applying",
  statePath: plan.statePath,
  manifestBefore,
  manifestAfter,
  changes: plan.actions.flatMap((action) => {
    const change = actionChange(action);
    if (change === null) return [];
    return [change];
  }),
});

export const writeApplyJournal = async (
  root: string,
  statePath: string,
  journal: ApplyJournal,
): Promise<Result<void, CoreError>> =>
  writeAtomicText(root, journalPathFor(statePath), serializeApplyJournal(journal));

const restoreFile = async (
  root: string,
  path: string,
  file: JournalFile | null,
  expected: FileRecord | null,
): Promise<Result<void, CoreError>> => {
  if (file === null) return removeContainedFile(root, path, true, expected);
  if (expected === null) return createAtomicFile(root, path, file.content, file.mode);
  return replaceAtomicFile(root, path, expected, file.content, file.mode);
};

const recordEquals = (record: FileRecord | null, file: JournalFile | null): boolean => {
  if (record === null || file === null) return record === file;
  if (!contentEquals(record.content, file.content)) return false;
  if (file.mode === undefined) return true;
  return record.mode === file.mode;
};

const rollbackChange = async (
  root: string,
  change: JournalChange,
): Promise<Result<void, CoreError>> => {
  const current = await readOptionalFileRecord(root, change.path, "apply");
  if (!current.ok) return current;
  if (recordEquals(current.value, change.before)) return ok(undefined);
  if (!recordEquals(current.value, change.after)) {
    return err({
      code: "apply",
      message: "Apply journal conflicts with destination content",
      path: change.path,
    });
  }
  return restoreFile(root, change.path, change.before, current.value);
};

const verifyCommittedChange = async (
  root: string,
  change: JournalChange,
): Promise<Result<void, CoreError>> => {
  const current = await readOptionalFileRecord(root, change.path, "apply");
  if (!current.ok) return current;
  if (recordEquals(current.value, change.after)) return ok(undefined);
  return err({
    code: "apply",
    message: "Committed apply journal conflicts with destination content",
    path: change.path,
  });
};

const recoveryChanges = (journal: ApplyJournal): readonly JournalChange[] => {
  if (journal.phase === "applying") return journal.changes.toReversed();
  return journal.changes;
};

const recoveryManifest = (journal: ApplyJournal): string | null => {
  if (journal.phase === "applying") return journal.manifestBefore;
  return journal.manifestAfter;
};

export const recoverApplyJournal = async (
  root: string,
  statePath: string,
): Promise<Result<void, CoreError>> => {
  const loaded = await loadApplyRecoveryState(root, statePath);
  if (!loaded.ok) return loaded;
  if (loaded.value === null) return ok(undefined);
  const journal = loaded.value;
  const changes = recoveryChanges(journal);
  const recovered = await reduceAsync(
    changes,
    async (result: Result<void, CoreError>, change) => {
      if (!result.ok) return result;
      if (journal.phase === "applying") return rollbackChange(root, change);
      return verifyCommittedChange(root, change);
    },
    ok(undefined) as Result<void, CoreError>,
  );
  if (!recovered.ok) return recovered;
  const expectedManifest = recoveryManifest(journal);
  const currentManifest = await readOptionalText(root, statePath, "apply");
  if (!currentManifest.ok) return currentManifest;
  if (
    currentManifest.value !== expectedManifest &&
    currentManifest.value !== journal.manifestAfter
  ) {
    return err({
      code: "apply",
      message: "Apply journal conflicts with ownership manifest",
      path: statePath,
    });
  }
  if (journal.phase === "applying" && currentManifest.value !== journal.manifestBefore) {
    if (journal.manifestBefore === null) return removeContainedFile(root, statePath, true);
    const restored = await writeAtomicText(root, statePath, journal.manifestBefore);
    if (!restored.ok) return restored;
  }
  return removeContainedFile(root, journalPathFor(statePath));
};
