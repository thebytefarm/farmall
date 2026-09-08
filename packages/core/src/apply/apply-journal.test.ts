import { mkdir, stat, symlink } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  createApplyJournal,
  journalPathFor,
  loadApplyJournal,
  recoverApplyJournal,
  writeApplyJournal,
  type ApplyJournal,
} from "./apply-journal.ts";
import {
  desiredFile,
  manifestText,
  readTestBytes,
  readTestFile,
  withTestFilesystem,
  writeTestFile,
  writeTestBytes,
} from "../test-filesystem.ts";
import { digest } from "../filesystem/content-digest.ts";
import type { Plan } from "../planning/types.ts";

const beforeManifest = manifestText([]);
const afterManifest = manifestText([
  {
    path: "manifest-owned",
    output: "x",
    plugin: "x",
    sources: [],
    digest: digest("after"),
  },
]);

const journal = (overrides: Partial<ApplyJournal> = {}): ApplyJournal => ({
  version: 2,
  phase: "applying",
  statePath: ".state.json",
  manifestBefore: beforeManifest,
  manifestAfter: afterManifest,
  changes: [],
  ...overrides,
});

const file = (content: string, mode = 0o644) => ({ content, mode });

const encodedFile = (value: { readonly content: string; readonly mode?: number } | null) => {
  if (value === null) return null;
  return { ...value, content: { encoding: "utf8", data: value.content } };
};

describe("apply journal", () => {
  it("derives only mutating changes from every plan variant", () => {
    const desired = desiredFile("desired.md", "after");
    const plan: Plan = {
      root: "/project",
      statePath: ".state.json",
      manifest: { version: 1, entries: [] },
      actions: [
        {
          action: "create",
          path: "create.md",
          output: "x",
          after: "created",
          afterMode: 0o700,
          desired,
        },
        {
          action: "update",
          path: "update.md",
          output: "x",
          before: "before",
          after: "after",
          beforeMode: 0o755,
          afterMode: 0o700,
          desired,
        },
        {
          action: "delete",
          path: "delete.md",
          output: "x",
          before: "deleted",
          beforeMode: 0o755,
        },
        { action: "noop", path: "noop.md", output: "x", before: "same", after: "same", desired },
        { action: "conflict", path: "conflict.md", output: "x", before: "human", reason: "edited" },
      ],
    };

    expect(createApplyJournal(plan, null, "manifest").changes).toEqual([
      { action: "create", path: "create.md", before: null, after: file("created", 0o700) },
      {
        action: "update",
        path: "update.md",
        before: file("before", 0o755),
        after: file("after", 0o700),
      },
      { action: "delete", path: "delete.md", before: file("deleted", 0o755), after: null },
    ]);
    expect(journalPathFor("state")).toBe("state.journal");
  });

  it("rejects update plans missing their known final mode", () => {
    const desired = desiredFile("update.md", "after");
    const plan: Plan = {
      root: "/project",
      statePath: ".state.json",
      manifest: { version: 1, entries: [] },
      actions: [
        {
          action: "update",
          path: "update.md",
          output: "x",
          before: "before",
          beforeMode: 0o755,
          after: "after",
          desired,
        },
      ],
    };

    expect(() => createApplyJournal(plan, null, "manifest")).toThrow(
      "Mutating plan action is missing a POSIX mode",
    );
  });

  it("rolls back interrupted create, update, delete, and manifest writes in reverse", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "created.md", "created"),
        writeTestFile(root, "updated.md", "after"),
        writeTestFile(root, "unchanged.md", "before"),
        writeTestFile(root, ".state.json", afterManifest),
      ]);
      await writeApplyJournal(
        root,
        ".state.json",
        journal({
          changes: [
            { action: "create", path: "created.md", before: null, after: file("created") },
            {
              action: "update",
              path: "updated.md",
              before: file("before"),
              after: file("after"),
            },
            {
              action: "update",
              path: "unchanged.md",
              before: file("before"),
              after: file("after"),
            },
            { action: "delete", path: "deleted.md", before: file("deleted"), after: null },
          ],
        }),
      );

      await expect(recoverApplyJournal(root, ".state.json")).resolves.toEqual({
        ok: true,
        value: undefined,
      });
      await expect(readTestFile(root, "created.md")).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readTestFile(root, "updated.md")).resolves.toBe("before");
      await expect(readTestFile(root, "unchanged.md")).resolves.toBe("before");
      await expect(readTestFile(root, "deleted.md")).resolves.toBe("deleted");
      await expect(readTestFile(root, ".state.json")).resolves.toBe(beforeManifest);
    }));

  it("round-trips binary journal content and restores executable mode", async () =>
    withTestFilesystem(async (root) => {
      const before = new Uint8Array([0, 0xff, 1]);
      const after = new Uint8Array([0, 0xfe, 2]);
      await writeTestBytes(root, "tool", after, 0o700);
      const plan: Plan = {
        root,
        statePath: ".state.json",
        manifest: { version: 1, entries: [] },
        actions: [
          {
            action: "update",
            path: "tool",
            output: "x",
            before,
            after,
            beforeMode: 0o755,
            afterMode: 0o700,
            desired: desiredFile("tool", after, { mode: 0o700 }),
          },
        ],
      };
      await writeApplyJournal(root, ".state.json", createApplyJournal(plan, null, afterManifest));
      const persisted = await readTestFile(root, ".state.json.journal");
      expect(persisted).toContain('"version": 2');
      expect(persisted).toContain('"encoding": "base64"');
      expect(persisted).not.toContain('"0": 0');

      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({ ok: true });
      await expect(readTestBytes(root, "tool")).resolves.toEqual(before);
      expect((await stat(`${root}/tool`)).mode & 0o7777).toBe(0o755);
    }));

  it("recovers legacy version 1 text journals", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "created.md", "created");
      await writeTestFile(
        root,
        ".state.json.journal",
        JSON.stringify({
          version: 1,
          phase: "applying",
          statePath: ".state.json",
          manifestBefore: null,
          manifestAfter: afterManifest,
          changes: [{ action: "create", path: "created.md", before: null, after: "created" }],
        }),
      );

      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({ ok: true });
      await expect(readTestFile(root, "created.md")).rejects.toMatchObject({ code: "ENOENT" });
    }));

  it("recovers legacy version 1 update and delete records", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "updated", "after");
      await writeTestFile(
        root,
        ".state.json.journal",
        JSON.stringify({
          version: 1,
          phase: "applying",
          statePath: ".state.json",
          manifestBefore: null,
          manifestAfter: afterManifest,
          changes: [
            { action: "update", path: "updated", before: "before", after: "after" },
            { action: "delete", path: "deleted", before: "deleted", after: null },
          ],
        }),
      );

      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({ ok: true });
      await expect(readTestFile(root, "updated")).resolves.toBe("before");
      await expect(readTestFile(root, "deleted")).resolves.toBe("deleted");
    }));

  it("cleans a committed journal only when destinations and manifest match after state", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "created.md", "created"),
        writeTestFile(root, ".state.json", afterManifest),
      ]);
      await writeApplyJournal(
        root,
        ".state.json",
        journal({
          phase: "committed",
          changes: [{ action: "create", path: "created.md", before: null, after: file("created") }],
        }),
      );

      await expect(recoverApplyJournal(root, ".state.json")).resolves.toEqual({
        ok: true,
        value: undefined,
      });
      await expect(readTestFile(root, "created.md")).resolves.toBe("created");
    }));

  it("rejects committed destination and manifest conflicts", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "created.md", "human");
      await writeApplyJournal(
        root,
        ".state.json",
        journal({
          phase: "committed",
          changes: [{ action: "create", path: "created.md", before: null, after: file("created") }],
        }),
      );
      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({
        ok: false,
        error: { message: "Committed apply journal conflicts with destination content" },
      });

      await writeTestFile(root, "created.md", "created");
      await writeTestFile(root, ".state.json", beforeManifest);
      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({
        ok: false,
        error: { message: "Apply journal conflicts with ownership manifest" },
      });
    }));

  it.each([
    "{",
    "null",
    JSON.stringify({ version: 2 }),
    JSON.stringify({
      version: 2,
      phase: "applying",
      statePath: ".state.json",
      manifestBefore: null,
      manifestAfter: "manifest",
      changes: [
        {
          action: "create",
          path: "file",
          before: null,
          after: { content: { encoding: "base64", data: "not-base64" } },
        },
      ],
    }),
  ])("rejects malformed journal %j", async (content) =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, ".state.json.journal", content);
      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({
        ok: false,
        error: { path: ".state.json.journal" },
      });
    }),
  );

  it.each(
    [
      [{ action: "create", path: "file", before: file("wrong"), after: file("after") }],
      [{ action: "update", path: "file", before: null, after: file("after") }],
      [{ action: "delete", path: "file", before: file("before"), after: file("wrong") }],
      [{ action: "create", path: "a//b", before: null, after: file("after") }],
      [
        { action: "create", path: "a//b", before: null, after: file("after") },
        { action: "create", path: "other", before: null, after: file("after") },
      ],
      [
        { action: "create", path: "file", before: null, after: file("after") },
        { action: "delete", path: "file", before: file("before"), after: null },
      ],
      [{ action: "create", path: ".state.json", before: null, after: file("after") }],
      [{ action: "create", path: ".state.json.lock.reap", before: null, after: file("after") }],
      [{ action: "create", path: "file", before: null, after: file("after", 0o10_000) }],
      [
        {
          action: "update",
          path: "file",
          before: { content: "before" },
          after: file("after"),
        },
      ],
      [{ action: "delete", path: "file", before: { content: "before" }, after: null }],
    ].map((changes) => [changes] as const),
  )("rejects corrupt action records %#", async (changes) =>
    withTestFilesystem(async (root) => {
      const encoded = changes.map((change) => ({
        ...change,
        before: encodedFile(change.before),
        after: encodedFile(change.after),
      }));
      await writeTestFile(
        root,
        ".state.json.journal",
        JSON.stringify({ ...journal(), changes: encoded }),
      );
      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({ ok: false });
    }),
  );

  it("rejects journals with malformed or duplicate embedded manifests", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(
        root,
        ".state.json.journal",
        JSON.stringify({ ...journal(), manifestAfter: "{}" }),
      );
      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({ ok: false });

      const duplicate = manifestText([
        { path: "same", output: "x", plugin: "x", sources: [], digest: digest("x") },
        { path: "same", output: "x", plugin: "x", sources: [], digest: digest("x") },
      ]);
      await writeTestFile(
        root,
        ".state.json.journal",
        JSON.stringify({ ...journal(), manifestAfter: duplicate }),
      );
      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({ ok: false });
    }));

  it("rejects a journal for a different manifest and unreadable journal files", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(
        root,
        ".state.json.journal",
        JSON.stringify(journal({ statePath: "other" })),
      );
      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({ ok: false });
      await mkdir(`${root}/directory.journal`);
      await expect(recoverApplyJournal(root, "directory")).resolves.toMatchObject({ ok: false });
    }));

  it("stops recovery after the first conflicting change", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "first.md", "human");
      await writeTestFile(root, "second.md", "after");
      await writeApplyJournal(
        root,
        ".state.json",
        journal({
          changes: [
            {
              action: "update",
              path: "second.md",
              before: file("before"),
              after: file("after"),
            },
            {
              action: "update",
              path: "first.md",
              before: file("before"),
              after: file("after"),
            },
          ],
        }),
      );

      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({ ok: false });
      await expect(readTestFile(root, "second.md")).resolves.toBe("after");
    }));

  it("rejects leaf symlinks during recovery", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "target", "after");
      await symlink("target", `${root}/linked`);
      await writeApplyJournal(
        root,
        ".state.json",
        journal({
          changes: [{ action: "create", path: "linked", before: null, after: file("after") }],
        }),
      );

      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({
        ok: false,
        error: { message: "Output path contains a symbolic link", path: "linked" },
      });
    }));

  it("rejects journal paths with symlink ancestors while planning", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "target/file", "after");
      await symlink("target", `${root}/linked`);
      await writeTestFile(
        root,
        ".state.json.journal",
        JSON.stringify({
          version: 1,
          phase: "applying",
          statePath: ".state.json",
          manifestBefore: null,
          manifestAfter: afterManifest,
          changes: [{ action: "create", path: "linked/file", before: null, after: "after" }],
        }),
      );

      await expect(loadApplyJournal(root, ".state.json")).resolves.toMatchObject({
        ok: false,
        error: { message: "Output path contains a symbolic link", path: "linked/file" },
      });
    }));

  it("accepts untouched applying journals with present or absent manifests", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, ".state.json", beforeManifest);
      await writeApplyJournal(root, ".state.json", journal());
      await expect(recoverApplyJournal(root, ".state.json")).resolves.toEqual({
        ok: true,
        value: undefined,
      });

      await writeApplyJournal(
        root,
        ".state.json",
        journal({ manifestBefore: null, manifestAfter: afterManifest, changes: [] }),
      );
      await writeTestFile(root, ".state.json", afterManifest);
      await expect(recoverApplyJournal(root, ".state.json")).resolves.toEqual({
        ok: true,
        value: undefined,
      });
      await expect(readTestFile(root, ".state.json")).rejects.toMatchObject({ code: "ENOENT" });
    }));

  it("returns unreadable destination and manifest errors", async () =>
    withTestFilesystem(async (root) => {
      await mkdir(`${root}/destination`);
      await writeApplyJournal(
        root,
        ".state.json",
        journal({
          changes: [
            {
              action: "update",
              path: "destination",
              before: file("before"),
              after: file("after"),
            },
          ],
        }),
      );
      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({ ok: false });

      await writeApplyJournal(root, "manifest", journal({ statePath: "manifest" }));
      await mkdir(`${root}/manifest`);
      await expect(recoverApplyJournal(root, "manifest")).resolves.toMatchObject({ ok: false });

      await writeApplyJournal(
        root,
        "committed",
        journal({
          phase: "committed",
          statePath: "committed",
          manifestAfter: afterManifest,
          changes: [
            {
              action: "update",
              path: "destination",
              before: file("before"),
              after: file("after"),
            },
          ],
        }),
      );
      await expect(recoverApplyJournal(root, "committed")).resolves.toMatchObject({ ok: false });
    }));
});
