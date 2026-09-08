import { spawn } from "node:child_process";
import { mkdir, rm, symlink, utimes } from "node:fs/promises";
import { hostname } from "node:os";

import { describe, expect, it } from "vitest";

import {
  acquireApplyLock,
  isLockOwnerProvablyDead,
  processIdentityOrFallback,
  processIdentityFor,
  type ApplyLockMetadata,
} from "./apply-lock.ts";
import { createPlan } from "../planning/create-plan.ts";
import { withTestFilesystem, writeTestFile } from "../test-filesystem.ts";

describe("process identity", () => {
  const metadata: ApplyLockMetadata = {
    version: 1,
    pid: 1,
    hostname: "local",
    acquiredAt: new Date().toISOString(),
    processStartedAt: new Date(0).toISOString(),
    processIdentity: "aix:identity",
    nonce: "nonce",
  };

  it("reads Linux, macOS, and unsupported platform identities", async () => {
    const linuxStat = `1 (node) ${["S", ...Array.from({ length: 18 }, () => "0"), "42"].join(" ")}`;
    const readLinux = async () => linuxStat;
    const runMac = async () => "Mon Jan  1 00:00:00 2024";
    const runMissing = async () => "";

    await expect(processIdentityFor(1, "linux", readLinux)).resolves.toBe("linux:42");
    await expect(processIdentityFor(1, "darwin", readLinux, runMac)).resolves.toBe(
      "darwin:Mon Jan  1 00:00:00 2024",
    );
    await expect(processIdentityFor(1, "darwin", readLinux, runMissing)).resolves.toBeNull();
    await expect(processIdentityFor(1, "win32", readLinux, runMac)).resolves.toBeNull();
    expect(processIdentityOrFallback("darwin:start", "darwin", "/node")).toBe("darwin:start");
    expect(processIdentityOrFallback(null, "win32", "C:/node.exe")).toBe(
      "win32:unavailable:C:/node.exe",
    );
  });

  it("rejects malformed or unreadable Linux process records", async () => {
    const malformed = async () => "missing command terminator";
    const short = async () => "1 (node) S";
    const unreadable = async (): Promise<string> => Promise.reject(new Error("missing"));

    await expect(processIdentityFor(1, "linux", malformed)).resolves.toBeNull();
    await expect(processIdentityFor(1, "linux", short)).resolves.toBeNull();
    await expect(processIdentityFor(1, "linux", unreadable)).resolves.toBeNull();
    await expect(processIdentityFor(process.pid, "linux")).resolves.toBeNull();
  });

  it("requires a verifiable matching process identity", async () => {
    const signal = () => undefined;
    const unavailable = async () => null;
    const same = async () => "aix:identity";
    const reused = async () => "aix:other";
    const denied = () => {
      throw Object.assign(new Error("denied"), { code: "EPERM" });
    };

    await expect(
      isLockOwnerProvablyDead(metadata, unavailable, signal, "local", "aix"),
    ).resolves.toBe(false);
    await expect(isLockOwnerProvablyDead(metadata, same, signal, "local", "aix")).resolves.toBe(
      false,
    );
    await expect(isLockOwnerProvablyDead(metadata, reused, signal, "local", "aix")).resolves.toBe(
      true,
    );
    await expect(isLockOwnerProvablyDead(metadata, reused, denied, "local", "aix")).resolves.toBe(
      false,
    );
  });
});

describe("apply lock recovery gate", () => {
  it("recovers abandoned malformed and dead gates but blocks fresh gates", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", []);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const gatePath = `${root}/.state.json.lock.reap`;
      await writeTestFile(root, ".state.json.lock.reap", "malformed");
      await expect(acquireApplyLock(plan.value)).resolves.toMatchObject({ ok: false });

      const old = new Date(Date.now() - 10 * 60 * 1_000);
      await utimes(gatePath, old, old);
      const malformed = await acquireApplyLock(plan.value);
      expect(malformed).toMatchObject({
        ok: true,
        value: { warnings: [{ code: "stale-lock-recovered" }] },
      });
      if (!malformed.ok) return;
      await malformed.value.release();

      const child = spawn(process.execPath, ["-e", ""]);
      const pid = child.pid;
      await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
      expect(pid).toBeTypeOf("number");
      if (pid === undefined) return;
      await writeTestFile(
        root,
        ".state.json.lock.reap",
        `${JSON.stringify({
          version: 1,
          pid,
          hostname: hostname(),
          acquiredAt: new Date().toISOString(),
          processStartedAt: new Date(0).toISOString(),
          processIdentity: process.execPath,
          nonce: "dead-gate",
        })}\n`,
      );
      const dead = await acquireApplyLock(plan.value);
      expect(dead).toMatchObject({ ok: true });
      if (!dead.ok) return;
      await dead.value.release();
    }));

  it("rejects unsafe and unreadable recovery gates", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", []);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      await writeTestFile(root, "target", "target");
      await symlink("target", `${root}/.state.json.lock.reap`);
      await expect(acquireApplyLock(plan.value)).resolves.toMatchObject({ ok: false });
      await rm(`${root}/.state.json.lock.reap`);
      await mkdir(`${root}/.state.json.lock.reap`);
      await expect(acquireApplyLock(plan.value)).resolves.toMatchObject({ ok: false });
      await rm(`${root}/.state.json.lock.reap`, { recursive: true });

      await writeTestFile(
        root,
        ".state.json.lock.reap",
        `${JSON.stringify({
          version: 1,
          pid: process.pid,
          hostname: hostname(),
          acquiredAt: new Date().toISOString(),
          processStartedAt: new Date(0).toISOString(),
          processIdentity: process.execPath,
          nonce: "live-gate",
        })}\n`,
      );
      await expect(acquireApplyLock(plan.value)).resolves.toMatchObject({ ok: false });
    }));

  it("preserves changed, missing, and unreadable locks during release", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", []);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;

      const missing = await acquireApplyLock(plan.value);
      expect(missing.ok).toBe(true);
      if (!missing.ok) return;
      await rm(`${root}/.state.json.lock`);
      await expect(missing.value.release()).resolves.toMatchObject([{ code: "lock-cleanup" }]);

      const unsafe = await acquireApplyLock(plan.value);
      expect(unsafe.ok).toBe(true);
      if (!unsafe.ok) return;
      await rm(`${root}/.state.json.lock`);
      await writeTestFile(root, "target", "target");
      await symlink("target", `${root}/.state.json.lock`);
      await expect(unsafe.value.release()).resolves.toMatchObject([{ code: "lock-cleanup" }]);
      await rm(`${root}/.state.json.lock`);

      const unreadable = await acquireApplyLock(plan.value);
      expect(unreadable.ok).toBe(true);
      if (!unreadable.ok) return;
      await rm(`${root}/.state.json.lock`);
      await mkdir(`${root}/.state.json.lock`);
      await expect(unreadable.value.release()).resolves.toMatchObject([{ code: "lock-cleanup" }]);
    }));
});
