import { mkdir, realpath, symlink } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  canonicalizeContainedPath,
  resolveContainedPath,
  validateRelativePath,
} from "./contained-path.ts";
import { withTestFilesystem } from "../test-filesystem.ts";

describe("canonicalizeContainedPath", () => {
  it.each([
    "",
    ".",
    "./.",
    "../outside",
    "a/../outside",
    "/outside",
    "C:\\outside",
    "a\\b",
    "a\0b",
  ])("rejects unsafe path %j", (path) => {
    expect(canonicalizeContainedPath(path)).toMatchObject({ ok: false, error: { path } });
  });

  it("canonicalizes safe aliases before comparisons", () => {
    expect(canonicalizeContainedPath("./a//./b.md")).toEqual({ ok: true, value: "a/b.md" });
  });
});

describe("validateRelativePath", () => {
  it("accepts an explicit root and rejects non-canonical aliases", () => {
    expect(validateRelativePath(".", "plugin", true)).toEqual({ ok: true, value: "." });
    expect(validateRelativePath("a//b", "plugin")).toMatchObject({
      ok: false,
      error: { code: "plugin", path: "a//b" },
    });
  });
});

describe("resolveContainedPath", () => {
  it("resolves a missing contained destination", async () =>
    withTestFilesystem(async (root) => {
      const canonicalRoot = await realpath(root);
      await expect(resolveContainedPath(root, "nested/file.md")).resolves.toEqual({
        ok: true,
        value: join(canonicalRoot, "nested/file.md"),
      });
    }));

  it("rejects a destination escaping through a symlink", async () =>
    withTestFilesystem(async (temporary) => {
      const root = join(temporary, "root");
      const outside = join(temporary, "outside");
      await Promise.all([mkdir(root), mkdir(outside)]);
      await symlink(outside, join(root, "linked"));

      await expect(resolveContainedPath(root, "linked/file.md")).resolves.toMatchObject({
        ok: false,
        error: { code: "plan", path: "linked/file.md" },
      });
    }));

  it("returns errors for missing roots and non-directory ancestors", async () =>
    withTestFilesystem(async (root) => {
      await expect(resolveContainedPath(join(root, "missing"), "file.md")).resolves.toMatchObject({
        ok: false,
      });
    }));
});
