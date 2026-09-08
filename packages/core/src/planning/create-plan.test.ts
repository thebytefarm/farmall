import { chmod, mkdir, symlink } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { digest } from "../filesystem/content-digest.ts";
import {
  desiredFile,
  manifestText,
  readTestBytes,
  withTestFilesystem,
  writeTestFile,
} from "../test-filesystem.ts";
import { applyPlan } from "../apply/apply-plan.ts";
import { createPlan } from "./create-plan.ts";

describe("createPlan", () => {
  afterEach(() => vi.restoreAllMocks());

  it("snapshots desired bytes before the caller can mutate them", async () =>
    withTestFilesystem(async (root) => {
      const desired = new Uint8Array([1, 2, 3]);
      const result = await createPlan(root, ".state.json", [desiredFile("output.bin", desired)]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      desired[0] = 9;
      await expect(applyPlan(result.value)).resolves.toMatchObject({ ok: true });
      await expect(readTestBytes(root, "output.bin")).resolves.toEqual(new Uint8Array([1, 2, 3]));
      expect(result.value.manifest.entries[0]?.digest).toBe(digest(new Uint8Array([1, 2, 3])));
    }));

  it.each([-1, 0o10_000, 1.5])("rejects invalid POSIX mode %s", async (mode) =>
    withTestFilesystem(async (root) => {
      await expect(
        createPlan(root, ".state.json", [desiredFile("tool", "content", { mode })]),
      ).resolves.toMatchObject({ ok: false, error: { message: "Invalid POSIX mode for tool" } });
    }),
  );
  it("produces create, update, delete, noop, and conflict variants", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "update.md", "before"),
        writeTestFile(root, "delete.md", "delete"),
        writeTestFile(root, "same.md", "same"),
        writeTestFile(root, "unmanaged.md", "human"),
      ]);
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          {
            path: "update.md",
            output: "codex",
            plugin: "farmall:codex",
            sources: [],
            digest: digest("before"),
          },
          {
            path: "delete.md",
            output: "codex",
            plugin: "farmall:codex",
            sources: [],
            digest: digest("delete"),
          },
          {
            path: "same.md",
            output: "codex",
            plugin: "farmall:codex",
            sources: [],
            digest: digest("same"),
          },
          {
            path: "absent.md",
            output: "codex",
            plugin: "farmall:codex",
            sources: [],
            digest: digest("absent"),
          },
        ]),
      );

      const result = await createPlan(root, ".state.json", [
        desiredFile("create.md", "created"),
        desiredFile("update.md", "after"),
        desiredFile("same.md", "same"),
        desiredFile("unmanaged.md", "generated"),
      ]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.actions.map(({ action, path }) => ({ action, path }))).toEqual([
        { action: "noop", path: "absent.md" },
        { action: "create", path: "create.md" },
        { action: "delete", path: "delete.md" },
        { action: "noop", path: "same.md" },
        { action: "conflict", path: "unmanaged.md" },
        { action: "update", path: "update.md" },
      ]);
    }));

  it("treats create-only mode differences as conflicts", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "tool", "content");
      await expect(
        createPlan(root, ".state.json", [
          desiredFile("tool", "content", { writePolicy: "create-only", mode: 0o755 }),
        ]),
      ).resolves.toMatchObject({
        ok: true,
        value: { actions: [{ action: "conflict", reason: "create-only output already exists" }] },
      });
    }));

  it("preserves matching managed file modes", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "tool", "content");
      await chmod(`${root}/tool`, 0o600);
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          {
            path: "tool",
            output: "codex",
            plugin: "farmall:codex",
            sources: [],
            digest: digest("content"),
          },
        ]),
      );

      await expect(
        createPlan(root, ".state.json", [desiredFile("tool", "content", { mode: 0o600 })]),
      ).resolves.toMatchObject({
        ok: true,
        value: { actions: [{ action: "noop", beforeMode: 0o600, afterMode: 0o600 }] },
      });
    }));

  it("merges identical aliases and rejects incompatible aliases", async () =>
    withTestFilesystem(async (root) => {
      const merged = await createPlan(root, ".state.json", [
        desiredFile("a//b.md", "same", { output: "a", plugin: "a", sources: ["a"] }),
        desiredFile("a/./b.md", "same", { output: "b", plugin: "b", sources: ["b"] }),
      ]);
      const conflict = await createPlan(root, ".state.json", [
        desiredFile("a//b.md", "one"),
        desiredFile("a/./b.md", "two"),
        desiredFile("later.md", "later"),
      ]);

      expect(merged).toMatchObject({
        ok: true,
        value: { manifest: { entries: [{ path: "a/b.md", output: "a,b", plugin: "a,b" }] } },
      });
      expect(conflict).toMatchObject({ ok: false, error: { path: "a/b.md" } });
    }));

  it(
    "plans several thousand desired and stale paths in deterministic order",
    { timeout: 30_000 },
    async () =>
      withTestFilesystem(async (root) => {
        const count = 3_000;
        const pathFor = (kind: string, index: number): string =>
          `${kind}/${String(index).padStart(4, "0")}.md`;
        const indexes = Array.from({ length: count }, (_value, index) => count - index - 1);
        const staleEntries = indexes.map((index) => ({
          path: pathFor("stale", index),
          output: "scale",
          plugin: "scale",
          sources: [],
          digest: digest(String(index)),
        }));
        const desired = indexes.map((index) =>
          desiredFile(pathFor("desired", index), String(index), {
            output: "scale",
            plugin: "scale",
          }),
        );
        await writeTestFile(root, ".state.json", manifestText(staleEntries));

        const promiseAll = vi.spyOn(Promise, "all");

        const result = await createPlan(root, ".state.json", desired);
        const fullPathBatches = promiseAll.mock.calls.filter(
          ([values]) => Array.isArray(values) && values.length === count,
        ).length;
        vi.restoreAllMocks();

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const paths = result.value.actions.map(({ path }) => path);
        expect(paths).toHaveLength(count * 2);
        expect(paths).toEqual(paths.toSorted());
        expect(paths[0]).toBe(pathFor("desired", 0));
        expect(paths.at(-1)).toBe(pathFor("stale", count - 1));
        expect(fullPathBatches).toBe(3);
      }),
  );

  it.each([".state.json", ".state.json.lock", ".state.json.lock.reap", ".state.json.journal"])(
    "rejects collision with reserved apply path %s",
    async (path) =>
      withTestFilesystem(async (root) => {
        await expect(
          createPlan(root, ".state.json", [desiredFile(path, "x")]),
        ).resolves.toMatchObject({
          ok: false,
          error: { message: "An output collides with Farmall apply state", path },
        });
      }),
  );

  it("enforces create-only and ownership boundaries", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "create-only.md", "same"),
        writeTestFile(root, "foreign.md", "foreign"),
        writeTestFile(root, "edited.md", "human"),
      ]);
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          {
            path: "foreign.md",
            pipeline: "alpha",
            output: "codex",
            plugin: "farmall:codex",
            sources: [],
            digest: digest("foreign"),
          },
          {
            path: "edited.md",
            pipeline: "beta",
            output: "codex",
            plugin: "farmall:codex",
            sources: [],
            digest: digest("generated"),
          },
        ]),
      );
      const result = await createPlan(
        root,
        ".state.json",
        [
          desiredFile("create-only.md", "same", { writePolicy: "create-only" }),
          desiredFile("foreign.md", "takeover"),
          desiredFile("edited.md", "replacement"),
        ],
        "beta",
      );

      expect(result).toMatchObject({
        ok: true,
        value: {
          actions: [
            { action: "noop", path: "create-only.md" },
            { action: "conflict", path: "edited.md", reason: "managed output was edited" },
            {
              action: "conflict",
              path: "foreign.md",
              reason: "destination is managed by pipeline alpha",
            },
          ],
        },
      });
    }));

  it("reports absent foreign claims, changed output owners, create-only conflicts, and edited stale files", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "owner.md", "owned"),
        writeTestFile(root, "create-only.md", "human"),
        writeTestFile(root, "stale.md", "human"),
      ]);
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          {
            path: "absent.md",
            pipeline: "alpha",
            output: "codex",
            plugin: "farmall:codex",
            sources: [],
            digest: digest("absent"),
          },
          {
            path: "owner.md",
            pipeline: "beta",
            output: "other",
            plugin: "other",
            sources: [],
            digest: digest("owned"),
          },
          {
            path: "stale.md",
            pipeline: "beta",
            output: "codex",
            plugin: "farmall:codex",
            sources: [],
            digest: digest("generated"),
          },
        ]),
      );

      const result = await createPlan(
        root,
        ".state.json",
        [
          desiredFile("absent.md", "desired"),
          desiredFile("owner.md", "replacement"),
          desiredFile("create-only.md", "generated", { writePolicy: "create-only" }),
        ],
        "beta",
      );

      expect(result).toMatchObject({
        ok: true,
        value: {
          actions: [
            { action: "conflict", path: "absent.md", after: "desired" },
            {
              action: "conflict",
              path: "create-only.md",
              reason: "create-only output already exists",
            },
            {
              action: "conflict",
              path: "owner.md",
              reason: "destination is managed by a different output",
            },
            { action: "conflict", path: "stale.md", reason: "stale managed output was edited" },
          ],
        },
      });
      if (result.ok) expect(result.value.actions[0]).not.toHaveProperty("before");
    }));

  it("returns unsafe state, desired read, stale read, and invalid manifest errors", async () =>
    withTestFilesystem(async (root) => {
      await expect(createPlan(root, "../state", [])).resolves.toMatchObject({ ok: false });
      await expect(
        createPlan(root, ".state.json", [
          desiredFile("../outside", "x"),
          desiredFile("later", "x"),
        ]),
      ).resolves.toMatchObject({ ok: false, error: { path: "../outside" } });
      await mkdir(`${root}/blocked`);
      await expect(
        createPlan(root, ".state.json", [desiredFile("blocked", "x"), desiredFile("later", "x")]),
      ).resolves.toMatchObject({ ok: false });
      await writeTestFile(root, ".state.json", "{");
      await expect(createPlan(root, ".state.json", [])).resolves.toMatchObject({ ok: false });
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          { path: "blocked", output: "x", plugin: "x", sources: [], digest: digest("x") },
        ]),
      );
      await expect(createPlan(root, ".state.json", [])).resolves.toMatchObject({ ok: false });
    }));

  it("rejects leaf symlinks instead of reading their targets", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "target", "target");
      await symlink("target", `${root}/linked`);

      await expect(
        createPlan(root, ".state.json", [desiredFile("linked", "replacement")]),
      ).resolves.toMatchObject({
        ok: false,
        error: { message: "Output path contains a symbolic link", path: "linked" },
      });
    }));

  it("treats legacy ownership entries as default-pipeline claims", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          { path: "legacy.md", output: "x", plugin: "x", sources: [], digest: digest("missing") },
        ]),
      );
      await expect(
        createPlan(root, ".state.json", [desiredFile("legacy.md", "desired")], "other"),
      ).resolves.toMatchObject({
        ok: true,
        value: { actions: [{ reason: "destination is managed by pipeline default" }] },
      });
    }));

  it("uses disk content outside an interrupted journal and rejects invalid journal state", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "disk.md", "human");
      await writeTestFile(
        root,
        ".state.json.journal",
        JSON.stringify({
          version: 1,
          phase: "applying",
          statePath: ".state.json",
          manifestBefore: null,
          manifestAfter: manifestText([]),
          changes: [
            { action: "update", path: "disk.md", before: "before", after: "other" },
            { action: "create", path: "created.md", before: null, after: "created" },
          ],
        }),
      );
      await expect(
        createPlan(root, ".state.json", [desiredFile("disk.md", "generated")]),
      ).resolves.toMatchObject({
        ok: true,
        value: { actions: [{ action: "conflict", path: "disk.md" }] },
      });
      await expect(
        createPlan(root, ".state.json", [desiredFile("unrelated.md", "generated")]),
      ).resolves.toMatchObject({
        ok: true,
        value: { actions: [{ action: "create", path: "unrelated.md" }] },
      });
      await expect(
        createPlan(root, ".state.json", [desiredFile("created.md", "created")]),
      ).resolves.toMatchObject({
        ok: true,
        value: { actions: [{ action: "create", path: "created.md" }] },
      });
      await writeTestFile(
        root,
        ".state.json.journal",
        JSON.stringify({
          version: 2,
          phase: "applying",
          statePath: ".state.json",
          manifestBefore: null,
          manifestAfter: manifestText([]),
          changes: [
            {
              action: "update",
              path: "disk.md",
              before: { content: { encoding: "utf8", data: "before" }, mode: 0o755 },
              after: { content: { encoding: "utf8", data: "after" }, mode: 0o700 },
            },
          ],
        }),
      );
      await expect(
        createPlan(root, ".state.json", [desiredFile("disk.md", "generated")]),
      ).resolves.toMatchObject({
        ok: true,
        value: { actions: [{ beforeMode: 0o755 }] },
      });
      await writeTestFile(root, ".state.json.journal", "{");
      await expect(createPlan(root, ".state.json", [])).resolves.toMatchObject({ ok: false });
    }));
});
