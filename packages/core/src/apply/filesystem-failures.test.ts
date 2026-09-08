import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { hostname } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createPlan } from "../planning/create-plan.ts";
import { desiredFile, withTestFilesystem } from "../test-filesystem.ts";

afterEach(() => {
  vi.doUnmock("node:fs/promises");
  vi.resetModules();
});

describe("filesystem failures", () => {
  it("cleans an unpublished lock when directory fsync fails", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", []);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        open: async (
          path: Parameters<typeof actual.open>[0],
          flags: Parameters<typeof actual.open>[1],
        ) => {
          const handle = await actual.open(path, flags);
          if (!String(path).endsWith(basename(root)) || flags !== "r") return handle;
          return new Proxy(handle, {
            get: (target, property) => {
              if (property === "sync")
                return async () => Promise.reject(new Error("directory fsync failed"));
              return Reflect.get(target, property, target);
            },
          });
        },
      }));
      vi.resetModules();
      const { applyPlan } = await import("./apply-plan.ts");

      await expect(applyPlan(plan.value)).resolves.toMatchObject({
        ok: false,
        error: { message: "directory fsync failed" },
      });
      await expect(readFile(join(root, ".state.json.lock"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    }));

  it("blocks a malformed lock that disappears before its age can be established", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", []);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      await actual.writeFile(join(root, ".state.json.lock"), "malformed");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        stat: async (path: Parameters<typeof actual.stat>[0]) => {
          if (String(path).endsWith(".lock"))
            throw Object.assign(new Error("gone"), { code: "ENOENT" });
          return actual.stat(path);
        },
      }));
      vi.resetModules();
      const { applyPlan } = await import("./apply-plan.ts");

      await expect(applyPlan(plan.value)).resolves.toMatchObject({ ok: false });
    }));

  it("contains malformed recovery-gate read and removal races", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", []);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      const gate = join(root, ".state.json.lock.reap");
      await actual.writeFile(gate, "malformed");
      const old = new Date(Date.now() - 10 * 60 * 1_000);
      await actual.utimes(gate, old, old);
      const gateOpens = vi.fn();
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        open: async (
          path: Parameters<typeof actual.open>[0],
          flags: Parameters<typeof actual.open>[1],
        ) => {
          if (String(path).endsWith(".state.json.lock.reap")) {
            gateOpens();
            if (gateOpens.mock.calls.length === 2) throw new Error("gate read failed");
          }
          return actual.open(path, flags);
        },
      }));
      vi.resetModules();
      const { applyPlan } = await import("./apply-plan.ts");
      await expect(applyPlan(plan.value)).resolves.toMatchObject({ ok: false });

      vi.doUnmock("node:fs/promises");
      vi.resetModules();
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        rm: async (
          path: Parameters<typeof actual.rm>[0],
          options?: Parameters<typeof actual.rm>[1],
        ) => {
          if (String(path).endsWith(".state.json.lock.reap")) {
            throw new Error("gate removal failed");
          }
          return actual.rm(path, options);
        },
      }));
      const reloaded = await import("./apply-plan.ts");
      await expect(reloaded.applyPlan(plan.value)).resolves.toMatchObject({ ok: false });
      await actual.rm(gate, { force: true });
    }));

  it.each(["dead gate release", "reaper publication", "lock read", "reaper release"])(
    "serializes the %s recovery race",
    async (failure) =>
      withTestFilesystem(async (root) => {
        const plan = await createPlan(root, ".state.json", []);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
        const lockPath = join(root, ".state.json.lock");
        const gatePath = `${lockPath}.reap`;
        const metadata = `${JSON.stringify({
          version: 1,
          pid: 999_999_999,
          hostname: hostname(),
          acquiredAt: new Date().toISOString(),
          processStartedAt: new Date(0).toISOString(),
          processIdentity: process.execPath,
          nonce: "dead",
        })}\n`;
        if (failure === "dead gate release") await actual.writeFile(gatePath, metadata);
        if (failure === "reaper publication" || failure === "reaper release") {
          await actual.writeFile(lockPath, metadata);
        }
        if (failure === "lock read") await actual.mkdir(lockPath);
        vi.doMock("node:fs/promises", () => ({
          ...actual,
          link: async (
            source: Parameters<typeof actual.link>[0],
            destination: Parameters<typeof actual.link>[1],
          ) => {
            if (
              failure === "reaper publication" &&
              String(destination).endsWith(".state.json.lock.reap")
            ) {
              throw Object.assign(new Error("gate exists"), { code: "EEXIST" });
            }
            return actual.link(source, destination);
          },
          rm: async (
            path: Parameters<typeof actual.rm>[0],
            options?: Parameters<typeof actual.rm>[1],
          ) => {
            if (
              (failure === "dead gate release" || failure === "reaper release") &&
              String(path).endsWith(".state.json.lock.reap")
            ) {
              throw new Error("gate release failed");
            }
            return actual.rm(path, options);
          },
        }));
        vi.resetModules();
        const { applyPlan } = await import("./apply-plan.ts");

        await expect(applyPlan(plan.value)).resolves.toMatchObject({ ok: false });
        await actual.rm(lockPath, { force: true, recursive: true });
        await actual.rm(gatePath, { force: true });
      }),
  );

  it("contains an ownership manifest read race after verification", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", []);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      const stateOpens = vi.fn();
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        open: async (
          path: Parameters<typeof actual.open>[0],
          flags: Parameters<typeof actual.open>[1],
        ) => {
          if (String(path).endsWith("/.state.json")) {
            stateOpens();
            if (stateOpens.mock.calls.length === 2) throw new Error("state read raced");
          }
          return actual.open(path, flags);
        },
      }));
      vi.resetModules();
      const { applyPlan } = await import("./apply-plan.ts");

      await expect(applyPlan(plan.value)).resolves.toMatchObject({
        ok: false,
        error: { message: "state read raced" },
      });
    }));

  it.each([
    ["ELOOP", "Output path contains a symbolic link"],
    ["EACCES", "open failed"],
  ])("contains no-follow open failure %s", async (errno, message) =>
    withTestFilesystem(async (root) => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      await actual.writeFile(join(root, "file"), "content");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        open: async (
          path: Parameters<typeof actual.open>[0],
          flags: Parameters<typeof actual.open>[1],
        ) => {
          if (String(path).endsWith("/file")) {
            throw Object.assign(new Error("open failed"), { code: errno });
          }
          return actual.open(path, flags);
        },
      }));
      vi.resetModules();
      const { readOptionalFileRecord } = await import("../filesystem/file-record.ts");

      await expect(readOptionalFileRecord(root, "file")).resolves.toMatchObject({
        ok: false,
        error: { message },
      });
    }),
  );

  it("rejects a file that changes while one handle reads it", async () =>
    withTestFilesystem(async (root) => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      await actual.writeFile(join(root, "file"), "content");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        open: async (
          path: Parameters<typeof actual.open>[0],
          flags: Parameters<typeof actual.open>[1],
        ) => {
          const handle = await actual.open(path, flags);
          if (!String(path).endsWith("/file")) return handle;
          const handleStat = vi.fn(async () => {
            const metadata = await handle.stat();
            if (handleStat.mock.calls.length === 2)
              return { ...metadata, mtimeMs: metadata.mtimeMs + 1 };
            return metadata;
          });
          return new Proxy(handle, {
            get: (target, property) => {
              if (property === "stat") return handleStat;
              return Reflect.get(target, property, target);
            },
          });
        },
      }));
      vi.resetModules();
      const { readOptionalFileRecord } = await import("../filesystem/file-record.ts");

      await expect(readOptionalFileRecord(root, "file")).resolves.toMatchObject({
        ok: false,
        error: { message: "Output changed while it was being read" },
      });
    }));

  it("contains destination metadata read failures", async () =>
    withTestFilesystem(async (root) => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        lstat: async () => {
          throw Object.assign(new Error("metadata denied"), { code: "EACCES" });
        },
      }));
      vi.resetModules();
      const { writeAtomicText } = await import("./atomic-file.ts");

      await expect(writeAtomicText(root, "file.md", "content")).resolves.toMatchObject({
        ok: false,
        error: { message: "metadata denied" },
      });
    }));
  it("contains staged-file fsync failures and cleans the temporary file", async () =>
    withTestFilesystem(async (root) => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        open: async (
          path: Parameters<typeof actual.open>[0],
          flags: Parameters<typeof actual.open>[1],
        ) => {
          const handle = await actual.open(path, flags);
          if (!String(path).includes(".file.md.")) return handle;
          return new Proxy(handle, {
            get: (target, property) => {
              if (property === "sync")
                return async () => Promise.reject(new Error("file fsync failed"));
              return Reflect.get(target, property, target);
            },
          });
        },
        rm: async (
          path: Parameters<typeof actual.rm>[0],
          options?: Parameters<typeof actual.rm>[1],
        ) => {
          if (String(path).includes(".output.md.")) throw new Error("cleanup failed");
          return actual.rm(path, options);
        },
      }));
      vi.resetModules();
      const { writeAtomicText } = await import("./atomic-file.ts");

      await expect(writeAtomicText(root, "file.md", "content")).resolves.toMatchObject({
        ok: false,
        error: { message: "file fsync failed" },
      });
      await expect(readFile(join(root, "file.md"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    }));

  it("contains lock fsync failures and attempts close and removal", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", [desiredFile("file.md", "content")]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        open: async (
          path: Parameters<typeof actual.open>[0],
          flags: Parameters<typeof actual.open>[1],
        ) => {
          const handle = await actual.open(path, flags);
          if (!String(path).includes(".state.json.lock.") || !String(path).endsWith(".tmp")) {
            return handle;
          }
          return new Proxy(handle, {
            get: (target, property) => {
              if (property === "sync")
                return async () => Promise.reject(new Error("lock fsync failed"));
              return Reflect.get(target, property, target);
            },
          });
        },
        rm: async (
          path: Parameters<typeof actual.rm>[0],
          options?: Parameters<typeof actual.rm>[1],
        ) => {
          if (String(path).includes(".output.md.")) throw new Error("cleanup failed");
          return actual.rm(path, options);
        },
      }));
      vi.resetModules();
      const { applyPlan } = await import("./apply-plan.ts");

      await expect(applyPlan(plan.value)).resolves.toMatchObject({
        ok: false,
        error: { message: "lock fsync failed", path: ".state.json.lock" },
      });
      await expect(readFile(join(root, ".state.json.lock"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    }));

  it("returns lock cleanup failures as warnings after a committed apply", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", [desiredFile("file.md", "content")]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        open: async (
          path: Parameters<typeof actual.open>[0],
          flags: Parameters<typeof actual.open>[1],
        ) => {
          const handle = await actual.open(path, flags);
          return handle;
        },
        rm: async (
          path: Parameters<typeof actual.rm>[0],
          options?: Parameters<typeof actual.rm>[1],
        ) => {
          if (String(path).endsWith(".lock")) throw new Error("lock removal failed");
          return actual.rm(path, options);
        },
      }));
      vi.resetModules();
      const { applyPlan } = await import("./apply-plan.ts");

      await expect(applyPlan(plan.value)).resolves.toMatchObject({
        ok: true,
        value: {
          created: 1,
          warnings: [{ code: "lock-cleanup", message: "lock removal failed" }],
        },
      });
      await actual.rm(join(root, ".state.json.lock"), { force: true });
    }));

  it("revalidates containment after staging and before rename", async () =>
    withTestFilesystem(async (temporary) => {
      const root = join(temporary, "root");
      const outside = join(temporary, "outside");
      await Promise.all([mkdir(join(root, "safe"), { recursive: true }), mkdir(outside)]);
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        open: async (
          path: Parameters<typeof actual.open>[0],
          flags: Parameters<typeof actual.open>[1],
        ) => {
          const handle = await actual.open(path, flags);
          if (!String(path).includes(".output.md.")) return handle;
          return new Proxy(handle, {
            get: (target, property) => {
              if (property !== "close") return Reflect.get(target, property, target);
              return async () => {
                await target.close();
                await actual.rename(join(root, "safe"), join(root, "safe-original"));
                await actual.symlink(outside, join(root, "safe"));
              };
            },
          });
        },
        rm: async () => Promise.reject(new Error("cleanup failed")),
      }));
      vi.resetModules();
      const { writeAtomicText } = await import("./atomic-file.ts");

      await expect(writeAtomicText(root, "safe/output.md", "content")).resolves.toMatchObject({
        ok: false,
        error: { message: "Output path contains a symbolic link" },
      });
      await expect(readFile(join(outside, "output.md"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    }));

  it("revalidates containment after creating the destination directory", async () =>
    withTestFilesystem(async (temporary) => {
      const root = join(temporary, "root");
      const outside = join(temporary, "outside");
      await Promise.all([mkdir(join(root, "safe"), { recursive: true }), mkdir(outside)]);
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        mkdir: async (
          path: Parameters<typeof actual.mkdir>[0],
          options?: Parameters<typeof actual.mkdir>[1],
        ) => {
          const result = await actual.mkdir(path, options);
          await actual.rename(join(root, "safe"), join(root, "safe-original"));
          await actual.symlink(outside, join(root, "safe"));
          return result;
        },
      }));
      vi.resetModules();
      const { writeAtomicText } = await import("./atomic-file.ts");

      await expect(writeAtomicText(root, "safe/output.md", "content")).resolves.toMatchObject({
        ok: false,
        error: { message: "Output path contains a symbolic link" },
      });
    }));

  it("contains rename and temporary cleanup failures", async () =>
    withTestFilesystem(async (root) => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        rename: async () => Promise.reject(new Error("rename failed")),
        rm: async (
          path: Parameters<typeof actual.rm>[0],
          options?: Parameters<typeof actual.rm>[1],
        ) => {
          if (String(path).includes(".file.md.")) throw new Error("cleanup failed");
          return actual.rm(path, options);
        },
      }));
      vi.resetModules();
      const { writeAtomicText } = await import("./atomic-file.ts");

      await expect(writeAtomicText(root, "file.md", "content")).resolves.toMatchObject({
        ok: false,
        error: { message: "rename failed" },
      });
    }));

  it("rejects a destination when a relative root changes before rename", async () =>
    withTestFilesystem(async (temporary) => {
      const originalCwd = process.cwd();
      const first = join(temporary, "first");
      const second = join(temporary, "second");
      await Promise.all([
        mkdir(join(first, "project"), { recursive: true }),
        mkdir(join(second, "project"), { recursive: true }),
      ]);
      process.chdir(first);
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        open: async (
          path: Parameters<typeof actual.open>[0],
          flags: Parameters<typeof actual.open>[1],
        ) => {
          const handle = await actual.open(path, flags);
          if (!String(path).includes(".output.md.")) return handle;
          return new Proxy(handle, {
            get: (target, property) => {
              if (property !== "close") return Reflect.get(target, property, target);
              return async () => {
                await target.close();
                process.chdir(second);
              };
            },
          });
        },
        rm: async () => Promise.reject(new Error("cleanup failed")),
      }));
      vi.resetModules();
      const { writeAtomicText } = await import("./atomic-file.ts");

      try {
        await expect(writeAtomicText("project", "output.md", "content")).resolves.toMatchObject({
          ok: false,
          error: { message: "Destination changed: output.md" },
        });
      } finally {
        process.chdir(originalCwd);
      }
    }));

  it.each(["initial journal", "manifest", "committed journal"])(
    "rolls back or stops safely when the %s write fails",
    async (failure) =>
      withTestFilesystem(async (root) => {
        const plan = await createPlan(root, ".state.json", [desiredFile("file.md", "content")]);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
        const journalRenames = vi.fn();
        vi.doMock("node:fs/promises", () => ({
          ...actual,
          rename: async (
            source: Parameters<typeof actual.rename>[0],
            destination: Parameters<typeof actual.rename>[1],
          ) => {
            if (String(destination).endsWith(".journal")) journalRenames();
            if (failure === "initial journal" && String(destination).endsWith(".journal")) {
              throw new Error("initial journal failed");
            }
            if (failure === "manifest" && String(destination).endsWith(".state.json")) {
              throw new Error("manifest failed");
            }
            if (
              failure === "committed journal" &&
              String(destination).endsWith(".journal") &&
              journalRenames.mock.calls.length === 2
            ) {
              throw new Error("committed journal failed");
            }
            return actual.rename(source, destination);
          },
        }));
        vi.resetModules();
        const { applyPlan } = await import("./apply-plan.ts");

        await expect(applyPlan(plan.value)).resolves.toMatchObject({ ok: false });
        await expect(readFile(join(root, "file.md"), "utf8")).rejects.toMatchObject({
          code: "ENOENT",
        });
      }),
  );

  it("reports journal cleanup as a warning without reverting committed files", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", [desiredFile("file.md", "content")]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        rm: async (
          path: Parameters<typeof actual.rm>[0],
          options?: Parameters<typeof actual.rm>[1],
        ) => {
          if (String(path).endsWith(".journal")) throw new Error("journal cleanup failed");
          return actual.rm(path, options);
        },
      }));
      vi.resetModules();
      const { applyPlan } = await import("./apply-plan.ts");

      await expect(applyPlan(plan.value)).resolves.toMatchObject({
        ok: true,
        value: { warnings: [{ code: "journal-cleanup", message: "journal cleanup failed" }] },
      });
      await expect(readFile(join(root, "file.md"), "utf8")).resolves.toBe("content");
      await actual.rm(join(root, ".state.json.journal"), { force: true });
    }));

  it("reports rollback failure while still releasing the lock", async () =>
    withTestFilesystem(async (root) => {
      const plan = await createPlan(root, ".state.json", [
        desiredFile("blocked", "file"),
        desiredFile("blocked/child.md", "child"),
      ]);
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        rm: async (
          path: Parameters<typeof actual.rm>[0],
          options?: Parameters<typeof actual.rm>[1],
        ) => {
          if (String(path).endsWith("/blocked")) throw new Error("rollback removal failed");
          return actual.rm(path, options);
        },
      }));
      vi.resetModules();
      const { applyPlan } = await import("./apply-plan.ts");

      await expect(applyPlan(plan.value)).resolves.toMatchObject({
        ok: false,
        error: { message: expect.stringContaining("rollback failed") },
      });
      await expect(readFile(join(root, ".state.json.lock"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    }));

  it.each(["manifest", "committed journal"])(
    "reports rollback failure after a failed %s write",
    async (failure) =>
      withTestFilesystem(async (root) => {
        const plan = await createPlan(root, ".state.json", [desiredFile("file.md", "content")]);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
        const journalRenames = vi.fn();
        vi.doMock("node:fs/promises", () => ({
          ...actual,
          rename: async (
            source: Parameters<typeof actual.rename>[0],
            destination: Parameters<typeof actual.rename>[1],
          ) => {
            if (String(destination).endsWith(".journal")) journalRenames();
            if (failure === "manifest" && String(destination).endsWith(".state.json")) {
              throw new Error("manifest failed");
            }
            if (
              failure === "committed journal" &&
              String(destination).endsWith(".journal") &&
              journalRenames.mock.calls.length === 2
            ) {
              throw new Error("commit failed");
            }
            return actual.rename(source, destination);
          },
          rm: async (
            path: Parameters<typeof actual.rm>[0],
            options?: Parameters<typeof actual.rm>[1],
          ) => {
            if (String(path).endsWith("/file.md")) throw new Error("rollback failed");
            if (failure === "committed journal" && String(path).endsWith("/.state.json")) {
              throw new Error("manifest rollback failed");
            }
            return actual.rm(path, options);
          },
        }));
        vi.resetModules();
        const { applyPlan } = await import("./apply-plan.ts");

        await expect(applyPlan(plan.value)).resolves.toMatchObject({
          ok: false,
          error: { message: expect.stringContaining("rollback failed") },
        });
        await actual.rm(join(root, ".state.json.lock"), { force: true });
      }),
  );

  it.each(["removal failed"])("handles a dead lock that is %s during recovery", async (failure) =>
    withTestFilesystem(async (root) => {
      const deadProcess = spawn(process.execPath, ["-e", ""]);
      const deadPid = deadProcess.pid;
      await new Promise<void>((resolveExit) => deadProcess.once("exit", () => resolveExit()));
      expect(deadPid).toBeTypeOf("number");
      if (deadPid === undefined) return;
      const lockPath = join(root, ".state.json.lock");
      const metadata = {
        version: 1,
        pid: deadPid,
        hostname: hostname(),
        acquiredAt: new Date().toISOString(),
        processStartedAt: new Date(0).toISOString(),
        processIdentity: process.execPath,
        nonce: "dead",
      };
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      await actual.writeFile(lockPath, JSON.stringify(metadata));
      const statMock = vi.fn(async (path: Parameters<typeof actual.stat>[0]) => {
        const value = await actual.stat(path);
        if (failure === "changed" && statMock.mock.calls.length === 2) {
          return { ...value, ino: value.ino + 1 };
        }
        return value;
      });
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        stat: statMock,
        readFile: async (
          path: Parameters<typeof actual.readFile>[0],
          options?: Parameters<typeof actual.readFile>[1],
        ) => {
          if (failure === "disappeared" && String(path).endsWith(".lock")) {
            throw Object.assign(new Error("gone"), { code: "ENOENT" });
          }
          return actual.readFile(path, options);
        },
        rm: async (
          path: Parameters<typeof actual.rm>[0],
          options?: Parameters<typeof actual.rm>[1],
        ) => {
          if (failure === "removal failed" && String(path).endsWith(".lock")) {
            throw new Error("stale lock removal failed");
          }
          return actual.rm(path, options);
        },
      }));
      vi.resetModules();
      const { applyPlan } = await import("./apply-plan.ts");

      await expect(
        applyPlan({
          root,
          statePath: ".state.json",
          previousManifest: { version: 1, entries: [] },
          actions: [],
          manifest: { version: 1, entries: [] },
        }),
      ).resolves.toMatchObject({ ok: false });
      await actual.rm(lockPath, { force: true });
    }),
  );

  it("returns unexpected realpath failures", async () =>
    withTestFilesystem(async (root) => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        lstat: async (path: Parameters<typeof actual.lstat>[0]) => {
          if (String(path).endsWith("blocked")) {
            throw Object.assign(new Error("denied"), { code: "EACCES" });
          }
          return actual.lstat(path);
        },
      }));
      vi.resetModules();
      const { resolveContainedPath } = await import("../filesystem/contained-path.ts");

      await expect(resolveContainedPath(root, "blocked")).resolves.toMatchObject({
        ok: false,
        error: { message: "denied" },
      });
    }));

  it("reports manifest restoration failures from an interrupted journal", async () =>
    withTestFilesystem(async (root) => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      const manifestBefore = `${JSON.stringify({ version: 1, entries: [] }, null, 2)}\n`;
      const manifestAfter = `${JSON.stringify(
        {
          version: 1,
          entries: [
            {
              path: "owned",
              output: "x",
              plugin: "x",
              sources: [],
              digest: "0".repeat(64),
            },
          ],
        },
        null,
        2,
      )}\n`;
      await actual.writeFile(join(root, ".state.json"), manifestAfter);
      await actual.writeFile(
        join(root, ".state.json.journal"),
        JSON.stringify({
          version: 1,
          phase: "applying",
          statePath: ".state.json",
          manifestBefore,
          manifestAfter,
          changes: [],
        }),
      );
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        rename: async (
          source: Parameters<typeof actual.rename>[0],
          destination: Parameters<typeof actual.rename>[1],
        ) => {
          if (String(destination).endsWith(".state.json")) throw new Error("restore failed");
          return actual.rename(source, destination);
        },
      }));
      vi.resetModules();
      const { recoverApplyJournal } = await import("./apply-journal.ts");

      await expect(recoverApplyJournal(root, ".state.json")).resolves.toMatchObject({
        ok: false,
        error: { message: "restore failed" },
      });
    }));
});
