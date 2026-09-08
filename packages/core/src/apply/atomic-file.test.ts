import { mkdir, open, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  createAtomicFile,
  removeContainedFile,
  replaceAtomicFile,
  syncDirectory,
  syncDirectoryWith,
  writeAtomicText,
} from "./atomic-file.ts";
import { readTestFile, withTestFilesystem, writeTestFile } from "../test-filesystem.ts";

describe("atomic file operations", () => {
  it("writes, replaces, and removes contained files", async () =>
    withTestFilesystem(async (root) => {
      await expect(writeAtomicText(root, "nested/file.md", "one")).resolves.toEqual({
        ok: true,
        value: undefined,
      });
      await expect(writeAtomicText(root, "nested/file.md", "two")).resolves.toEqual({
        ok: true,
        value: undefined,
      });
      await expect(readTestFile(root, "nested/file.md")).resolves.toBe("two");
      await expect(removeContainedFile(root, "nested/file.md")).resolves.toEqual({
        ok: true,
        value: undefined,
      });
      await expect(removeContainedFile(root, "nested/file.md", true)).resolves.toEqual({
        ok: true,
        value: undefined,
      });
      await expect(syncDirectory(root)).resolves.toBeUndefined();
    }));

  it("returns containment and ordinary filesystem errors", async () =>
    withTestFilesystem(async (root) => {
      await expect(writeAtomicText(root, "../outside", "x")).resolves.toMatchObject({ ok: false });
      await expect(removeContainedFile(root, "../outside")).resolves.toMatchObject({ ok: false });
      await writeTestFile(root, "parent", "file");
      await expect(writeAtomicText(root, "parent/child", "x")).resolves.toMatchObject({
        ok: false,
      });
      await expect(removeContainedFile(root, "missing")).resolves.toMatchObject({ ok: false });
    }));

  it("leaves no predictable temporary files", async () =>
    withTestFilesystem(async (root) => {
      await mkdir(`${root}/nested`);
      await writeAtomicText(root, "nested/file.md", "content");
      await expect(readFile(`${root}/nested/file.md`, "utf8")).resolves.toBe("content");
    }));

  it("skips unsupported directory handles on Windows", async () => {
    await expect(syncDirectoryWith("missing", "win32", open)).resolves.toBeUndefined();
  });

  it("publishes creates without replacing an existing leaf", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "existing", "human");

      await expect(createAtomicFile(root, "existing", "generated")).resolves.toMatchObject({
        ok: false,
      });
      await expect(readTestFile(root, "existing")).resolves.toBe("human");
    }));

  it("revalidates expected content at the replacement boundary", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "existing", "human");

      await expect(
        replaceAtomicFile(
          root,
          "existing",
          { content: new TextEncoder().encode("expected"), mode: 0o644 },
          "generated",
        ),
      ).resolves.toMatchObject({
        ok: false,
        error: { message: "Plan is stale; destination changed" },
      });
      await expect(readTestFile(root, "existing")).resolves.toBe("human");

      await expect(
        removeContainedFile(root, "missing", true, {
          content: new TextEncoder().encode("expected"),
          mode: 0o644,
        }),
      ).resolves.toMatchObject({ ok: false });
      await mkdir(`${root}/not-a-file`);
      await expect(
        removeContainedFile(root, "not-a-file", false, {
          content: new Uint8Array(),
          mode: 0o755,
        }),
      ).resolves.toMatchObject({ ok: false });
      await expect(createAtomicFile(root, "../outside", "content")).resolves.toMatchObject({
        ok: false,
      });
    }));
});
