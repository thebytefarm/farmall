import { constants } from "node:fs";
import { open } from "node:fs/promises";

import { resolveContainedPath } from "./contained-path.ts";
import { hasErrno } from "./errno.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import type { FileRecord } from "../artifacts/types.ts";
import type { CoreError } from "../diagnostics/types.ts";

export const permissionMode = (mode: number): number => mode & 0o7777;

type FileMetadata = Awaited<ReturnType<Awaited<ReturnType<typeof open>>["stat"]>>;

const fileIdentity = (metadata: FileMetadata): string =>
  `${metadata.dev}:${metadata.ino}:${metadata.size}:${metadata.mtimeMs}:${metadata.ctimeMs}`;

const sameFile = (before: FileMetadata, after: FileMetadata): boolean =>
  fileIdentity(before) === fileIdentity(after);

export const readOptionalFileRecord = async (
  root: string,
  path: string,
  code: CoreError["code"] = "plan",
): Promise<Result<FileRecord | null, CoreError>> => {
  const absolute = await resolveContainedPath(root, path, code);
  if (!absolute.ok) return absolute;
  try {
    const handle = await open(absolute.value, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const before = await handle.stat();
      if (!before.isFile()) return err({ code, message: "Output path is not a file", path });
      const content = await handle.readFile();
      const after = await handle.stat();
      if (!sameFile(before, after)) {
        return err({ code, message: "Output changed while it was being read", path });
      }
      return ok({ content: new Uint8Array(content), mode: permissionMode(after.mode) });
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (hasErrno(error, "ENOENT", "ENOTDIR")) return ok(null);
    if (hasErrno(error, "ELOOP")) {
      return err({ code, message: "Output path contains a symbolic link", path });
    }
    return err({ code, message: errorMessage(error), path });
  }
};
