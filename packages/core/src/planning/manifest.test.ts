import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { digest } from "../filesystem/content-digest.ts";
import { readOptionalText } from "../filesystem/text-file.ts";
import { manifestText, withTestFilesystem, writeTestFile } from "../test-filesystem.ts";
import { loadManifest, serializeManifest } from "./manifest.ts";

describe("manifest", () => {
  it("loads empty and valid manifests", async () =>
    withTestFilesystem(async (root) => {
      await expect(loadManifest(root, ".state.json")).resolves.toEqual({
        ok: true,
        value: { version: 1, entries: [] },
      });
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          {
            path: "owned.md",
            pipeline: "default",
            output: "codex",
            plugin: "farmall:codex",
            sources: [],
            digest: digest("owned"),
          },
        ]),
      );
      await expect(loadManifest(root, ".state.json")).resolves.toMatchObject({
        ok: true,
        value: { entries: [{ path: "owned.md" }] },
      });
      expect(serializeManifest({ version: 1, entries: [] })).toBe(manifestText([]));
    }));

  it.each([
    "{",
    JSON.stringify({ version: 2, entries: [] }),
    JSON.stringify({ version: 1, entries: [null] }),
    JSON.stringify({
      version: 1,
      entries: [{ path: "a", output: 1, plugin: "x", sources: [], digest: "x" }],
    }),
    JSON.stringify({
      version: 1,
      entries: [{ path: "a", pipeline: 1, output: "x", plugin: "x", sources: [], digest: "x" }],
    }),
  ])("rejects invalid manifest %j", async (content) =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, ".state.json", content);
      await expect(loadManifest(root, ".state.json")).resolves.toMatchObject({
        ok: false,
        error: { code: "plan", path: ".state.json" },
      });
    }),
  );

  it("rejects unsafe entries and unreadable state", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          { path: "../outside", output: "x", plugin: "x", sources: [], digest: digest("x") },
          { path: "safe", output: "x", plugin: "x", sources: [], digest: digest("x") },
        ]),
      );
      await expect(loadManifest(root, ".state.json")).resolves.toMatchObject({
        ok: false,
        error: { path: "../outside" },
      });
      await mkdir(`${root}/directory-state`);
      await expect(loadManifest(root, "directory-state")).resolves.toMatchObject({ ok: false });
    }));

  it("canonicalizes ownership aliases and rejects reserved apply paths", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          { path: "a//./b", output: "x", plugin: "x", sources: [], digest: digest("x") },
        ]),
      );
      await expect(loadManifest(root, ".state.json")).resolves.toMatchObject({
        ok: true,
        value: { entries: [{ path: "a/b" }] },
      });
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          {
            path: ".state.json.journal",
            output: "x",
            plugin: "x",
            sources: [],
            digest: digest("x"),
          },
        ]),
      );
      await expect(loadManifest(root, ".state.json")).resolves.toMatchObject({
        ok: false,
        error: { message: "Ownership entry collides with Farmall apply state" },
      });
    }));

  it("reports the first duplicate before later path validation failures", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          { path: "a//b", output: "x", plugin: "x", sources: [], digest: digest("x") },
          { path: "a/./b", output: "x", plugin: "x", sources: [], digest: digest("x") },
          { path: "../outside", output: "x", plugin: "x", sources: [], digest: digest("x") },
        ]),
      );

      await expect(loadManifest(root, ".state.json")).resolves.toMatchObject({
        ok: false,
        error: { message: "Duplicate ownership entry path", path: "a/b" },
      });
    }));

  it("rejects unsafe state paths and ownership paths escaping through symlinks", async () =>
    withTestFilesystem(async (temporary) => {
      await expect(loadManifest(temporary, "../state")).resolves.toMatchObject({ ok: false });
      const root = join(temporary, "root");
      const outside = join(temporary, "outside");
      await Promise.all([mkdir(root), mkdir(outside)]);
      await symlink(outside, join(root, "linked"));
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          {
            path: "linked/file",
            output: "x",
            plugin: "x",
            sources: [],
            digest: digest("x"),
          },
        ]),
      );
      await expect(loadManifest(root, ".state.json")).resolves.toMatchObject({ ok: false });
    }));

  it("contains unsafe optional text reads", async () =>
    withTestFilesystem(async (root) => {
      await expect(readOptionalText(root, "../outside")).resolves.toMatchObject({ ok: false });
    }));

  it("rejects non-UTF-8 ownership state", async () =>
    withTestFilesystem(async (root) => {
      await writeFile(`${root}/.state.json`, new Uint8Array([0xff]));
      await expect(loadManifest(root, ".state.json")).resolves.toMatchObject({ ok: false });
    }));
});
