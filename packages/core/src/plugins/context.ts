import { glob, readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { reduceAsync } from "massaman/array";

import type { CoreError } from "../diagnostics/types.ts";
import { hasErrno } from "../filesystem/errno.ts";
import { permissionMode } from "../filesystem/file-record.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import type { PluginContext } from "./types.ts";

const isInside = (root: string, path: string): boolean => {
  const relativePath = relative(root, path);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

const containedPath = async (root: string, path: string): Promise<Result<string, CoreError>> => {
  const absolutePath = resolve(root, path);
  if (!isInside(root, absolutePath)) {
    return err({ code: "source", message: "Path escapes project root", path });
  }
  try {
    const [canonicalRoot, canonicalPath] = await Promise.all([
      realpath(root),
      realpath(absolutePath),
    ]);
    if (isInside(canonicalRoot, canonicalPath)) return ok(absolutePath);
    return err({ code: "source", message: "Path escapes project root", path });
  } catch (error) {
    return err({ code: "source", message: errorMessage(error), path });
  }
};

const relativeFilePaths = (
  root: string,
  entries: readonly {
    readonly isFile: () => boolean;
    readonly parentPath: string;
    readonly name: string;
  }[],
): readonly string[] =>
  entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, resolve(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .toSorted();

const patternValues = (patterns: string | readonly string[]): readonly unknown[] => {
  if (typeof patterns === "string") return [patterns];
  return patterns;
};

const hasParentSegment = (pattern: string): boolean =>
  pattern.split(/[\\/]/).some((segment) => segment.split(/[,{}()|]/).includes(".."));

const globPatterns = (
  patterns: string | readonly string[],
): Result<readonly string[], CoreError> => {
  const values = patternValues(patterns);
  const invalid = values.find(
    (pattern) => typeof pattern !== "string" || isAbsolute(pattern) || hasParentSegment(pattern),
  );
  if (invalid === undefined) return ok(values as readonly string[]);
  return err({
    code: "source",
    message: "Glob pattern escapes project root",
    path: String(invalid),
  });
};

const containedGlobPaths = async (
  root: string,
  entries: readonly {
    readonly isFile: () => boolean;
    readonly parentPath: string;
    readonly name: string;
  }[],
): Promise<Result<readonly string[], CoreError>> => {
  const canonicalRoot = await realpath(root);
  return reduceAsync(
    entries.filter((entry) => entry.isFile()),
    async (current: Result<readonly string[], CoreError>, entry) => {
      if (!current.ok) return current;
      const absolutePath = resolve(entry.parentPath, entry.name);
      if (!isInside(root, absolutePath)) {
        return err({ code: "source", message: "Path escapes project root", path: absolutePath });
      }
      const canonicalPath = await realpath(absolutePath);
      if (!isInside(canonicalRoot, canonicalPath)) {
        return err({ code: "source", message: "Path escapes project root", path: absolutePath });
      }
      const relativePath = relative(root, absolutePath).replaceAll("\\", "/");
      return ok([...current.value, relativePath]);
    },
    ok([]),
  );
};

export const createPluginContext = (root: string): PluginContext => {
  const context: PluginContext = {
    root,
    read: async (path) => {
      const contained = await containedPath(root, path);
      if (!contained.ok) return contained;
      try {
        return ok(await readFile(contained.value, "utf8"));
      } catch (error) {
        return err({ code: "source", message: errorMessage(error), path });
      }
    },
    readBytes: async (path) => {
      const contained = await containedPath(root, path);
      if (!contained.ok) return contained;
      try {
        return ok(new Uint8Array(await readFile(contained.value)));
      } catch (error) {
        return err({ code: "source", message: errorMessage(error), path });
      }
    },
    readFileRecord: async (path) => {
      const contained = await containedPath(root, path);
      if (!contained.ok) return contained;
      try {
        const [content, metadata] = await Promise.all([
          readFile(contained.value),
          stat(contained.value),
        ]);
        return ok({ content: new Uint8Array(content), mode: permissionMode(metadata.mode) });
      } catch (error) {
        return err({ code: "source", message: errorMessage(error), path });
      }
    },
    glob: async (patterns) => {
      const validatedPatterns = globPatterns(patterns);
      if (!validatedPatterns.ok) return validatedPatterns;
      try {
        const entries = await Array.fromAsync(
          glob(validatedPatterns.value, {
            cwd: root,
            exclude: ["node_modules/**", ".git/**"],
            withFileTypes: true,
          }),
        );
        const paths = await containedGlobPaths(root, entries);
        if (!paths.ok) return paths;
        return ok(paths.value.toSorted());
      } catch (error) {
        return err({ code: "source", message: errorMessage(error), path: root });
      }
    },
    walk: async (path) => {
      const absolutePath = resolve(root, path);
      if (!isInside(root, absolutePath)) {
        return err({ code: "source", message: "Path escapes project root", path });
      }
      try {
        const [canonicalRoot, canonicalPath] = await Promise.all([
          realpath(root),
          realpath(absolutePath),
        ]);
        if (!isInside(canonicalRoot, canonicalPath)) {
          return err({ code: "source", message: "Path escapes project root", path });
        }
        const entries = await readdir(absolutePath, { recursive: true, withFileTypes: true });
        return ok(relativeFilePaths(root, entries));
      } catch (error) {
        if (hasErrno(error, "ENOENT")) return ok([]);
        return err({ code: "source", message: errorMessage(error), path });
      }
    },
  };
  return Object.freeze(context);
};
