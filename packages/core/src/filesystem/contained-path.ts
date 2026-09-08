import { lstat, realpath } from "node:fs/promises";
import { posix, resolve, win32 } from "node:path";

import { hasErrno } from "./errno.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import type { CoreError } from "../diagnostics/types.ts";

const pathError = (path: string, code: CoreError["code"]): CoreError => ({
  code,
  message: "Output path escapes project root",
  path,
});

export const canonicalizeContainedPath = (
  path: string,
  code: CoreError["code"] = "plan",
): Result<string, CoreError> => {
  if (path.length === 0 || path.includes("\0") || path.includes("\\")) {
    return err(pathError(path, code));
  }
  if (posix.isAbsolute(path) || win32.isAbsolute(path) || path.split("/").includes("..")) {
    return err(pathError(path, code));
  }
  const canonical = posix.normalize(path);
  if (canonical === ".") return err(pathError(path, code));
  return ok(canonical);
};

export const validateRelativePath = (
  path: string,
  code: CoreError["code"],
  allowRoot = false,
): Result<string, CoreError> => {
  if (allowRoot && path === ".") return ok(path);
  const canonical = canonicalizeContainedPath(path, code);
  if (!canonical.ok) return canonical;
  if (canonical.value !== path) return err(pathError(path, code));
  return canonical;
};

const validatePathSegments = async (
  root: string,
  path: string,
  code: CoreError["code"],
): Promise<Result<void, CoreError>> => {
  const segments = path.split("/");
  return segments.reduce(
    async (pending: Promise<Result<void, CoreError>>, _segment, index) => {
      const previous = await pending;
      if (!previous.ok) return previous;
      const candidate = resolve(root, ...segments.slice(0, index + 1));
      try {
        const metadata = await lstat(candidate);
        if (!metadata.isSymbolicLink()) return ok(undefined);
        return err({ code, message: "Output path contains a symbolic link", path });
      } catch (error) {
        if (hasErrno(error, "ENOENT", "ENOTDIR")) return ok(undefined);
        return err({ code, message: errorMessage(error), path });
      }
    },
    Promise.resolve(ok(undefined) as Result<void, CoreError>),
  );
};

export const resolveContainedPath = async (
  root: string,
  path: string,
  code: CoreError["code"] = "plan",
): Promise<Result<string, CoreError>> => {
  const canonical = canonicalizeContainedPath(path, code);
  if (!canonical.ok) return canonical;
  try {
    const canonicalRoot = await realpath(root);
    const absolute = resolve(canonicalRoot, canonical.value);
    const segments = await validatePathSegments(canonicalRoot, canonical.value, code);
    if (!segments.ok) return segments;
    return ok(absolute);
  } catch (error) {
    return err({ code, message: errorMessage(error), path });
  }
};
