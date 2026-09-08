import { randomUUID } from "node:crypto";
import { link, mkdir, open, rename, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import { resolveContainedPath } from "../filesystem/contained-path.ts";
import { contentBytes, contentEquals } from "../filesystem/file-content.ts";
import { readOptionalFileRecord } from "../filesystem/file-record.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import type { FileContent, FileRecord, PosixMode } from "../artifacts/types.ts";
import type { CoreError } from "../diagnostics/types.ts";

type OpenDirectory = typeof open;

export const syncDirectoryWith = async (
  path: string,
  platform: NodeJS.Platform,
  openDirectory: OpenDirectory,
): Promise<void> => {
  if (platform === "win32") return;
  const handle = await openDirectory(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
};

export const syncDirectory = async (path: string): Promise<void> =>
  syncDirectoryWith(path, process.platform, open);

const recordEquals = (record: FileRecord | null, expected: FileRecord | null): boolean => {
  if (record === null || expected === null) return record === expected;
  return record.mode === expected.mode && contentEquals(record.content, expected.content);
};

interface WriteOptions {
  readonly kind: "create" | "replace";
  readonly mode?: PosixMode | undefined;
  readonly expected?: FileRecord | undefined;
}

const verifyExpected = async (
  root: string,
  path: string,
  expected: FileRecord | null | undefined,
): Promise<Result<void, CoreError>> => {
  if (expected === undefined) return ok(undefined);
  const current = await readOptionalFileRecord(root, path, "apply");
  if (!current.ok) return current;
  if (recordEquals(current.value, expected)) return ok(undefined);
  return err({ code: "apply", message: "Plan is stale; destination changed", path });
};

const publishStagedFile = async (
  temporary: string,
  destination: string,
  options: WriteOptions,
): Promise<void> => {
  if (options.kind === "create") {
    await link(temporary, destination);
    await rm(temporary);
    return;
  }
  await rename(temporary, destination);
};

const writeAtomicFileWith = async (
  root: string,
  path: string,
  content: FileContent,
  options: WriteOptions,
): Promise<Result<void, CoreError>> => {
  const destination = await resolveContainedPath(root, path, "apply");
  if (!destination.ok) return destination;
  const parent = dirname(destination.value);
  const temporary = resolve(parent, `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await mkdir(parent, { recursive: true });
    const containedParent = await resolveContainedPath(root, path, "apply");
    if (!containedParent.ok) return containedParent;
    const handle = await open(temporary, "wx", options.mode ?? 0o666);
    try {
      await handle.writeFile(contentBytes(content));
      if (options.mode !== undefined) await handle.chmod(options.mode);
      await handle.sync();
    } finally {
      await handle.close();
    }
    const revalidated = await resolveContainedPath(root, path, "apply");
    if (!revalidated.ok) {
      await Promise.allSettled([rm(temporary, { force: true })]);
      return revalidated;
    }
    if (revalidated.value !== destination.value) {
      await Promise.allSettled([rm(temporary, { force: true })]);
      return err({ code: "apply", message: `Destination changed: ${path}`, path });
    }
    const verified = await verifyExpected(root, path, options.expected);
    if (!verified.ok) {
      await Promise.allSettled([rm(temporary, { force: true })]);
      return verified;
    }
    await publishStagedFile(temporary, destination.value, options);
    await syncDirectory(parent);
    return ok(undefined);
  } catch (error) {
    await Promise.allSettled([rm(temporary, { force: true })]);
    return err({ code: "apply", message: errorMessage(error), path });
  }
};

export const writeAtomicFile = async (
  root: string,
  path: string,
  content: FileContent,
  mode?: PosixMode,
): Promise<Result<void, CoreError>> => {
  const existing = await readOptionalFileRecord(root, path, "apply");
  if (!existing.ok) return existing;
  const targetMode = mode ?? existing.value?.mode;
  return writeAtomicFileWith(root, path, content, { kind: "replace", mode: targetMode });
};

export const createAtomicFile = async (
  root: string,
  path: string,
  content: FileContent,
  mode?: PosixMode,
): Promise<Result<void, CoreError>> =>
  writeAtomicFileWith(root, path, content, { kind: "create", mode });

export const replaceAtomicFile = async (
  root: string,
  path: string,
  expected: FileRecord,
  content: FileContent,
  mode?: PosixMode,
): Promise<Result<void, CoreError>> =>
  writeAtomicFileWith(root, path, content, { kind: "replace", mode, expected });

export const writeAtomicText = async (
  root: string,
  path: string,
  content: string,
): Promise<Result<void, CoreError>> => writeAtomicFile(root, path, content);

export const removeContainedFile = async (
  root: string,
  path: string,
  force = false,
  expected?: FileRecord | null,
): Promise<Result<void, CoreError>> => {
  const destination = await resolveContainedPath(root, path, "apply");
  if (!destination.ok) return destination;
  try {
    const verified = await verifyExpected(root, path, expected);
    if (!verified.ok) return verified;
    await rm(destination.value, { force });
    await syncDirectory(dirname(destination.value));
    return ok(undefined);
  } catch (error) {
    return err({ code: "apply", message: errorMessage(error), path });
  }
};
