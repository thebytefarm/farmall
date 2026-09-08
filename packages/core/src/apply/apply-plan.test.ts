import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, symlink, utimes } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createApplyJournal, writeApplyJournal } from "./apply-journal.ts";
import { acquireApplyLock } from "./apply-lock.ts";
import { applyPlan } from "./apply-plan.ts";
import { digest } from "../filesystem/content-digest.ts";
import { createPlan } from "../planning/create-plan.ts";
import { serializeManifest } from "../planning/manifest.ts";
import {
  desiredFile,
  manifestText,
  readTestFile,
  readTestBytes,
  withTestFilesystem,
  writeTestFile,
  writeTestBytes,
} from "../test-filesystem.ts";

describe("applyPlan", () => {
  it("preserves binary content and source or destination permission modes", async () =>
    withTestFilesystem(async (root) => {
      const before = new Uint8Array([0, 0xff, 1]);
      const after = new Uint8Array([0, 0xfe, 2]);
      await writeTestBytes(root, "existing.bin", before, 0o751);
      await writeTestFile(
        root,
        ".state.json",
        manifestText([
          {
            path: "existing.bin",
            output: "codex",
            plugin: "farmall:codex",
            sources: [],
            digest: digest(before),
          },
        ]),
      );
      const plan = await createPlan(root, ".state.json", [
        desiredFile("existing.bin", after),
        desiredFile("created.bin", before, { mode: 0o755 }),
      ]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;

      await expect(applyPlan(plan.value)).resolves.toMatchObject({ ok: true });
      await expect(readTestBytes(root, "existing.bin")).resolves.toEqual(after);
      await expect(readTestBytes(root, "created.bin")).resolves.toEqual(before);
      expect((await stat(`${root}/existing.bin`)).mode & 0o7777).toBe(0o751);
      expect((await stat(`${root}/created.bin`)).mode & 0o7777).toBe(0o755);

      const modeUpdate = await createPlan(root, ".state.json", [
        desiredFile("existing.bin", after, { mode: 0o700 }),
        desiredFile("created.bin", before, { mode: 0o755 }),
      ]);
      expect(modeUpdate.ok).toBe(true);
      if (!modeUpdate.ok) return;
      expect(modeUpdate.value.actions[1]).toMatchObject({ action: "update", afterMode: 0o700 });
      await applyPlan(modeUpdate.value);
      expect((await stat(`${root}/existing.bin`)).mode & 0o7777).toBe(0o700);
    }));
  it("applies create, update, and delete atomically and becomes idempotent", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "update.md", "before"),
        writeTestFile(root, "delete.md", "delete"),
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
        ]),
      );
      const plan = await createPlan(root, ".state.json", [
        desiredFile("create.md", "created"),
        desiredFile("update.md", "after"),
      ]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;

      await expect(applyPlan(plan.value)).resolves.toEqual({
        ok: true,
        value: { created: 1, updated: 1, deleted: 1, unchanged: 0 },
      });
      await expect(readTestFile(root, "create.md")).resolves.toBe("created");
      await expect(readTestFile(root, "update.md")).resolves.toBe("after");
      await expect(readTestFile(root, "delete.md")).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readTestFile(root, ".state.json.journal")).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(readTestFile(root, ".state.json.lock")).rejects.toMatchObject({
        code: "ENOENT",
      });

      const noop = await createPlan(root, ".state.json", [
        desiredFile("create.md", "created"),
        desiredFile("update.md", "after"),
      ]);
      expect(noop.ok).toBe(true);
      if (!noop.ok) return;
      await expect(applyPlan(noop.value)).resolves.toMatchObject({
        ok: true,
        value: { unchanged: 2 },
      });
    }));

  it("rejects conflicts, stale destinations, and concurrent manifests before writes", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "human.md", "human");
      const conflict = await createPlan(root, ".state.json", [
        desiredFile("human.md", "generated"),
      ]);
      expect(conflict.ok).toBe(true);
      if (!conflict.ok) return;
      await expect(applyPlan(conflict.value)).resolves.toMatchObject({
        ok: false,
        error: { path: "human.md" },
      });

      const first = await createPlan(root, ".state.json", [desiredFile("first.md", "first")]);
      const second = await createPlan(root, ".state.json", [desiredFile("second.md", "second")]);
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      await applyPlan(first.value);
      await expect(applyPlan(second.value)).resolves.toMatchObject({
        ok: false,
        error: { message: "Plan is stale; ownership manifest changed" },
      });

      const stale = await createPlan(root, ".state.json", [desiredFile("first.md", "changed")]);
      expect(stale.ok).toBe(true);
      if (!stale.ok) return;
      await writeTestFile(root, "first.md", "changed after planning");
      await expect(applyPlan(stale.value)).resolves.toMatchObject({
        ok: false,
        error: { message: "Plan is stale; destination changed" },
      });

      await writeTestBytes(root, "first.md", new TextEncoder().encode("first"), 0o644);
      const staleMode = await createPlan(root, ".state.json", [
        desiredFile("first.md", "first", { mode: 0o700 }),
      ]);
      expect(staleMode.ok).toBe(true);
      if (!staleMode.ok) return;
      await writeTestBytes(root, "first.md", new TextEncoder().encode("first"), 0o600);
      await expect(applyPlan(staleMode.value)).resolves.toMatchObject({
        ok: false,
        error: { message: "Plan is stale; destination changed" },
      });
    }));

  it("rejects plans without an ownership concurrency token", async () =>
    withTestFilesystem(async (root) => {
      await expect(
        applyPlan({
          root,
          statePath: ".state.json",
          actions: [],
          manifest: { version: 1, entries: [] },
        }),
      ).resolves.toMatchObject({
        ok: false,
        error: { message: "Plan is missing its ownership concurrency token" },
      });
    }));

  it("allows only one simultaneous apply", async () =>
    withTestFilesystem(async (root) => {
      const alpha = await createPlan(root, ".state.json", [desiredFile("shared.md", "alpha")]);
      const beta = await createPlan(root, ".state.json", [desiredFile("shared.md", "beta")]);
      expect(alpha.ok && beta.ok).toBe(true);
      if (!alpha.ok || !beta.ok) return;

      const results = await Promise.all([applyPlan(alpha.value), applyPlan(beta.value)]);

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toHaveLength(1);
    }));

  it("recovers an interrupted transaction before applying a later plan", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "owned.md", "before");
      const beforeManifest = manifestText([
        {
          path: "owned.md",
          output: "codex",
          plugin: "farmall:codex",
          sources: [],
          digest: digest("before"),
        },
      ]);
      await writeTestFile(root, ".state.json", beforeManifest);
      const crashed = await createPlan(root, ".state.json", [
        desiredFile("owned.md", "after"),
        desiredFile("created.md", "created"),
      ]);
      expect(crashed.ok).toBe(true);
      if (!crashed.ok) return;
      const afterManifest = serializeManifest(crashed.value.manifest);
      await writeApplyJournal(
        root,
        crashed.value.statePath,
        createApplyJournal(crashed.value, beforeManifest, afterManifest),
      );
      await Promise.all([
        writeTestFile(root, "owned.md", "after"),
        writeTestFile(root, "created.md", "created"),
      ]);

      const resumed = await createPlan(root, ".state.json", [
        desiredFile("owned.md", "after"),
        desiredFile("created.md", "created"),
      ]);
      expect(resumed.ok).toBe(true);
      if (!resumed.ok) return;
      expect(resumed.value.actions.map((action) => action.action)).toEqual(["create", "update"]);

      const result = await applyPlan(resumed.value);

      expect(result).toMatchObject({ ok: true });
      await expect(readTestFile(root, "owned.md")).resolves.toBe("after");
      await expect(readTestFile(root, "created.md")).resolves.toBe("created");
    }));

  it("blocks recovery when journal content conflicts", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", [desiredFile("created.md", "created")]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      await writeApplyJournal(
        root,
        plan.value.statePath,
        createApplyJournal(plan.value, null, serializeManifest(plan.value.manifest)),
      );
      await writeTestFile(root, "created.md", "human");

      await expect(applyPlan(plan.value)).resolves.toMatchObject({
        ok: false,
        error: { message: "Apply journal conflicts with destination content", path: "created.md" },
      });
    }));

  it("recovers a provably dead same-host lock and blocks live, remote, or unknown locks", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", [desiredFile("output.md", "output")]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const deadProcess = spawn(process.execPath, ["-e", ""]);
      const deadPid = deadProcess.pid;
      await new Promise<void>((resolveExit) => deadProcess.once("exit", () => resolveExit()));
      expect(deadPid).toBeTypeOf("number");
      if (deadPid === undefined) return;
      const metadata = {
        version: 1,
        pid: deadPid,
        hostname: hostname(),
        acquiredAt: new Date().toISOString(),
        processStartedAt: new Date(0).toISOString(),
        processIdentity: process.execPath,
        nonce: "dead",
      };
      await writeTestFile(root, ".state.json.lock", `${JSON.stringify(metadata)}\n`);
      const recoveredLock = await applyPlan(plan.value);
      expect(recoveredLock).toMatchObject({
        ok: true,
        value: { warnings: [{ code: "stale-lock-recovered" }] },
      });

      const next = await createPlan(root, ".state.json", [desiredFile("output.md", "output")]);
      expect(next.ok).toBe(true);
      if (!next.ok) return;
      await writeTestFile(root, ".state.json.lock", "unknown");
      await expect(applyPlan(next.value)).resolves.toMatchObject({
        ok: false,
        error: { message: "Another Farmall apply is already running" },
      });
      await writeTestFile(root, ".state.json.lock", "{}");
      await expect(applyPlan(next.value)).resolves.toMatchObject({ ok: false });
      await writeTestFile(
        root,
        ".state.json.lock",
        `${JSON.stringify({ ...metadata, hostname: "remote" })}\n`,
      );
      await expect(applyPlan(next.value)).resolves.toMatchObject({ ok: false });
      await writeTestFile(
        root,
        ".state.json.lock",
        `${JSON.stringify({ ...metadata, pid: process.pid })}\n`,
      );
      await expect(applyPlan(next.value)).resolves.toMatchObject({ ok: false });
    }));

  it("recovers conservatively aged malformed locks and detects reused process identities", async () =>
    withTestFilesystem(async (root) => {
      const malformedPlan = await createPlan(root, ".state.json", [desiredFile("first", "first")]);
      expect(malformedPlan.ok).toBe(true);
      if (!malformedPlan.ok) return;
      await writeTestFile(root, ".state.json.lock", "malformed");
      const old = new Date(Date.now() - 10 * 60 * 1_000);
      await utimes(`${root}/.state.json.lock`, old, old);
      await expect(applyPlan(malformedPlan.value)).resolves.toMatchObject({
        ok: true,
        value: { warnings: [{ code: "stale-lock-recovered" }] },
      });

      const reusedPlan = await createPlan(root, ".state.json", [desiredFile("first", "first")]);
      expect(reusedPlan.ok).toBe(true);
      if (!reusedPlan.ok) return;
      await writeTestFile(
        root,
        ".state.json.lock",
        `${JSON.stringify({
          version: 1,
          pid: process.pid,
          hostname: hostname(),
          acquiredAt: new Date().toISOString(),
          processStartedAt: new Date(0).toISOString(),
          processIdentity: `${process.platform}:not-this-process`,
          nonce: "reused",
        })}\n`,
      );
      await expect(applyPlan(reusedPlan.value)).resolves.toMatchObject({ ok: true });
    }));

  it("releases only the lock identity it acquired", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", []);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const lock = await acquireApplyLock(plan.value);
      expect(lock.ok).toBe(true);
      if (!lock.ok) return;
      await writeTestFile(root, ".state.json.lock", "replacement");

      await expect(lock.value.release()).resolves.toMatchObject([{ code: "lock-cleanup" }]);
      await expect(readTestFile(root, ".state.json.lock")).resolves.toBe("replacement");
      await rm(`${root}/.state.json.lock`);
    }));

  it("revalidates symlink containment at mutation time", async () =>
    withTestFilesystem(async (temporary) => {
      const root = join(temporary, "root");
      const outside = join(temporary, "outside");
      await Promise.all([mkdir(join(root, "safe"), { recursive: true }), mkdir(outside)]);
      const plan = await createPlan(root, ".state.json", [desiredFile("safe/output.md", "output")]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      await rm(join(root, "safe"), { recursive: true });
      await symlink(outside, join(root, "safe"));

      await expect(applyPlan(plan.value)).resolves.toMatchObject({
        ok: false,
        error: { message: "Output path contains a symbolic link" },
      });
      await expect(readFile(join(outside, "output.md"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    }));

  it("rejects a leaf symlink introduced after planning", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "target", "human");
      const plan = await createPlan(root, ".state.json", [desiredFile("output", "generated")]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      await symlink("target", `${root}/output`);

      await expect(applyPlan(plan.value)).resolves.toMatchObject({
        ok: false,
        error: { message: "Output path contains a symbolic link", path: "output" },
      });
      await expect(readTestFile(root, "target")).resolves.toBe("human");
    }));

  it("rolls back earlier mutations when a later action fails", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", [
        desiredFile("blocked", "file"),
        desiredFile("blocked/child.md", "child"),
        desiredFile("later.md", "later"),
      ]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;

      const failed = await applyPlan(plan.value);
      if (!failed.ok && failed.error.message.includes("rollback failed"))
        throw new Error(failed.error.message);
      expect(failed).toMatchObject({ ok: false, error: { code: "apply" } });
      await expect(readTestFile(root, "blocked")).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readTestFile(root, "later.md")).rejects.toMatchObject({ code: "ENOENT" });
    }));

  it("stops verification after the first stale action and contains unreadable manifest state", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "first.md", "changed"),
        writeTestFile(root, "second.md", "changed"),
      ]);
      await expect(
        applyPlan({
          root,
          statePath: ".state.json",
          previousManifest: { version: 1, entries: [] },
          actions: [
            {
              action: "update",
              path: "first.md",
              output: "x",
              before: "before",
              after: "after",
              desired: desiredFile("first.md", "after"),
            },
            {
              action: "update",
              path: "second.md",
              output: "x",
              before: "before",
              after: "after",
              desired: desiredFile("second.md", "after"),
            },
          ],
          manifest: { version: 1, entries: [] },
        }),
      ).resolves.toMatchObject({ ok: false, error: { path: "first.md" } });

      await mkdir(`${root}/state`);
      await expect(
        applyPlan({
          root,
          statePath: "state",
          previousManifest: { version: 1, entries: [] },
          actions: [],
          manifest: { version: 1, entries: [] },
        }),
      ).resolves.toMatchObject({ ok: false, error: { path: "state" } });
    }));

  it("contains invalid ownership manifests and unsafe lock paths", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", [desiredFile("file.md", "content")]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      await writeTestFile(root, ".state.json", "{");
      await expect(applyPlan(plan.value)).resolves.toMatchObject({
        ok: false,
        error: { path: ".state.json" },
      });
      await expect(
        applyPlan({
          root,
          statePath: "../state",
          previousManifest: { version: 1, entries: [] },
          actions: [],
          manifest: { version: 1, entries: [] },
        }),
      ).resolves.toMatchObject({ ok: false, error: { path: "../state.lock" } });
    }));
});
