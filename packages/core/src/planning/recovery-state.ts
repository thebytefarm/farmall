import { groupBy, reduceAsync } from "massaman/array";
import { match } from "massaman/match";
import { z } from "zod";

import type { FileContent, PosixMode } from "../artifacts/types.ts";
import type { CoreError } from "../diagnostics/types.ts";
import { resolveContainedPath, validateRelativePath } from "../filesystem/contained-path.ts";
import { isReservedStatePath } from "../filesystem/state-paths.ts";
import { readOptionalText } from "../filesystem/text-file.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import { parseManifestContent } from "./manifest.ts";

export interface JournalFile {
  readonly content: FileContent;
  readonly mode?: PosixMode | undefined;
}

interface ModeJournalFile extends JournalFile {
  readonly mode: PosixMode;
}

export type JournalChange =
  | {
      readonly action: "create";
      readonly path: string;
      readonly before: null;
      readonly after: JournalFile;
    }
  | {
      readonly action: "update";
      readonly path: string;
      readonly before: ModeJournalFile;
      readonly after: ModeJournalFile;
    }
  | {
      readonly action: "delete";
      readonly path: string;
      readonly before: ModeJournalFile;
      readonly after: null;
    };

export interface ApplyJournal {
  readonly version: 2;
  readonly phase: "applying" | "committed";
  readonly statePath: string;
  readonly manifestBefore: string | null;
  readonly manifestAfter: string;
  readonly changes: readonly JournalChange[];
}

const base64Data = z
  .string()
  .refine((data) => Buffer.from(data, "base64").toString("base64") === data);
const encodedContentSchema = z.discriminatedUnion("encoding", [
  z.object({ encoding: z.literal("utf8"), data: z.string() }).strict(),
  z.object({ encoding: z.literal("base64"), data: base64Data }).strict(),
]);
const journalFileSchema = z
  .object({ content: encodedContentSchema, mode: z.number().int().min(0).max(0o7777).optional() })
  .strict();
const modeJournalFileSchema = z
  .object({ content: encodedContentSchema, mode: z.number().int().min(0).max(0o7777) })
  .strict();
const journalChangeSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      path: z.string(),
      before: z.null(),
      after: journalFileSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("update"),
      path: z.string(),
      before: modeJournalFileSchema,
      after: modeJournalFileSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("delete"),
      path: z.string(),
      before: modeJournalFileSchema,
      after: z.null(),
    })
    .strict(),
]);
const applyJournalSchema = z
  .object({
    version: z.literal(2),
    phase: z.enum(["applying", "committed"]),
    statePath: z.string(),
    manifestBefore: z.string().nullable(),
    manifestAfter: z.string(),
    changes: z.array(journalChangeSchema),
  })
  .strict();
const legacyChangeSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("create"), path: z.string(), before: z.null(), after: z.string() })
    .strict(),
  z
    .object({
      action: z.literal("update"),
      path: z.string(),
      before: z.string(),
      after: z.string(),
    })
    .strict(),
  z
    .object({ action: z.literal("delete"), path: z.string(), before: z.string(), after: z.null() })
    .strict(),
]);
const legacyJournalSchema = z
  .object({
    version: z.literal(1),
    phase: z.enum(["applying", "committed"]),
    statePath: z.string(),
    manifestBefore: z.string().nullable(),
    manifestAfter: z.string(),
    changes: z.array(legacyChangeSchema),
  })
  .strict();

export const journalPathFor = (statePath: string): string => `${statePath}.journal`;

const encodeContent = (content: FileContent): z.infer<typeof encodedContentSchema> => {
  if (typeof content === "string") return { encoding: "utf8", data: content };
  return { encoding: "base64", data: Buffer.from(content).toString("base64") };
};

const encodeFile = (file: JournalFile | null): unknown => {
  if (file === null) return null;
  return { ...file, content: encodeContent(file.content) };
};

export const serializeApplyJournal = (journal: ApplyJournal): string =>
  `${JSON.stringify(
    {
      ...journal,
      changes: journal.changes.map((change) => ({
        ...change,
        before: encodeFile(change.before),
        after: encodeFile(change.after),
      })),
    },
    null,
    2,
  )}\n`;

const decodeContent = (content: z.infer<typeof encodedContentSchema>): FileContent => {
  if (content.encoding === "utf8") return content.data;
  return new Uint8Array(Buffer.from(content.data, "base64"));
};

const decodeFile = (file: z.infer<typeof journalFileSchema>): JournalFile => ({
  ...file,
  content: decodeContent(file.content),
});

const decodeChange = (change: z.infer<typeof journalChangeSchema>): JournalChange =>
  match(change)
    .with({ action: "create" }, (create) => ({
      ...create,
      before: null,
      after: decodeFile(create.after),
    }))
    .with({ action: "update" }, (update) => ({
      ...update,
      before: decodeFile(update.before) as ModeJournalFile,
      after: decodeFile(update.after) as ModeJournalFile,
    }))
    .with({ action: "delete" }, (deleted) => ({
      ...deleted,
      before: decodeFile(deleted.before) as ModeJournalFile,
      after: null,
    }))
    .exhaustive();

const decodedJournal = (value: z.infer<typeof applyJournalSchema>): ApplyJournal => ({
  ...value,
  changes: value.changes.map(decodeChange),
});

const journalFile = (content: FileContent): JournalFile => ({ content });

const legacyModeFile = (content: FileContent): ModeJournalFile =>
  journalFile(content) as ModeJournalFile;

const upgradeChange = (change: z.infer<typeof legacyChangeSchema>): JournalChange =>
  match(change)
    .with({ action: "create" }, (create) => ({
      ...create,
      before: null,
      after: journalFile(create.after),
    }))
    .with({ action: "update" }, (update) => ({
      ...update,
      before: legacyModeFile(update.before),
      after: legacyModeFile(update.after),
    }))
    .with({ action: "delete" }, (deleted) => ({
      ...deleted,
      before: legacyModeFile(deleted.before),
      after: null,
    }))
    .exhaustive();

const upgradedJournal = (value: z.infer<typeof legacyJournalSchema>): ApplyJournal => ({
  ...value,
  version: 2,
  changes: value.changes.map(upgradeChange),
});

const validateJournal = async (
  root: string,
  expectedStatePath: string,
  path: string,
  journal: ApplyJournal,
): Promise<Result<ApplyJournal, CoreError>> => {
  const statePath = validateRelativePath(journal.statePath, "apply");
  if (!statePath.ok || statePath.value !== expectedStatePath) {
    return err({ code: "apply", message: "Invalid Farmall apply journal", path });
  }
  const groupedPaths = Object.values(groupBy(journal.changes, (change) => `path:${change.path}`));
  if (groupedPaths.some((changes) => changes.length > 1)) {
    return err({ code: "apply", message: "Invalid Farmall apply journal", path });
  }
  const validPaths = await reduceAsync(
    journal.changes,
    async (result: Result<void, CoreError>, change) => {
      if (!result.ok) return result;
      const canonical = validateRelativePath(change.path, "apply");
      if (!canonical.ok || isReservedStatePath(expectedStatePath, change.path)) {
        return err<CoreError>({ code: "apply", message: "Invalid Farmall apply journal", path });
      }
      const contained = await resolveContainedPath(root, change.path, "apply");
      if (!contained.ok) return contained;
      return ok(undefined);
    },
    ok(undefined) as Result<void, CoreError>,
  );
  if (!validPaths.ok) return validPaths;
  const before = await parseManifestContent(root, expectedStatePath, journal.manifestBefore);
  const after = await parseManifestContent(root, expectedStatePath, journal.manifestAfter);
  if (!before.ok || !after.ok) {
    return err({ code: "apply", message: "Invalid Farmall apply journal", path });
  }
  return ok(journal);
};

export const loadApplyRecoveryState = async (
  root: string,
  statePath: string,
): Promise<Result<ApplyJournal | null, CoreError>> => {
  const path = journalPathFor(statePath);
  const content = await readOptionalText(root, path, "apply");
  if (!content.ok) return content;
  if (content.value === null) return ok(null);
  try {
    const value: unknown = JSON.parse(content.value);
    const current = applyJournalSchema.safeParse(value);
    if (current.success)
      return validateJournal(root, statePath, path, decodedJournal(current.data));
    const legacy = legacyJournalSchema.safeParse(value);
    if (legacy.success) return validateJournal(root, statePath, path, upgradedJournal(legacy.data));
    return err({ code: "apply", message: "Invalid Farmall apply journal", path });
  } catch (error) {
    return err({ code: "apply", message: errorMessage(error), path });
  }
};
