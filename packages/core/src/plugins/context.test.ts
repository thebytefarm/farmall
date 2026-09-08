import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { withTestFilesystem, writeTestBytes, writeTestFile } from "../test-filesystem.ts";
import { createPluginContext } from "./context.ts";

afterEach(() => {
  vi.doUnmock("node:fs/promises");
  vi.resetModules();
});

describe("createPluginContext", () => {
  it("freezes the context without disabling its methods", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "file.txt", "usable");
      const context = createPluginContext(root);

      expect(Object.isFrozen(context)).toBe(true);
      expect(Reflect.set(context, "read", async () => ({ ok: true, value: "poisoned" }))).toBe(
        false,
      );
      await expect(context.read("file.txt")).resolves.toEqual({ ok: true, value: "usable" });
    }));

  it("reads, walks, and globs sorted project files", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "docs/z.md", "z"),
        writeTestFile(root, "docs/a.md", "a"),
        writeTestFile(root, "docs/.hidden/config.json", "{}"),
        writeTestFile(root, "node_modules/hidden.md", "hidden"),
        writeTestFile(root, ".git/hidden.md", "hidden"),
      ]);
      await symlink(join(root, "docs"), join(root, "linked-docs"));
      const context = createPluginContext(root);

      await expect(context.read("linked-docs/a.md")).resolves.toEqual({ ok: true, value: "a" });
      await expect(context.glob("**/*.md")).resolves.toEqual({
        ok: true,
        value: ["docs/a.md", "docs/z.md"],
      });
      await expect(context.walk("linked-docs")).resolves.toEqual({
        ok: true,
        value: ["linked-docs/.hidden/config.json", "linked-docs/a.md", "linked-docs/z.md"],
      });
    }));

  it("supports contained brace and globstar patterns", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "docs/guides/start.md", "start"),
        writeTestFile(root, "docs/reference/api.mdx", "api"),
        writeTestFile(root, "docs/reference/api.txt", "ignored"),
      ]);

      await expect(createPluginContext(root).glob("docs/**/*.{md,mdx}")).resolves.toEqual({
        ok: true,
        value: ["docs/guides/start.md", "docs/reference/api.mdx"],
      });
    }));

  it("rejects absolute and parent-traversing glob patterns", async () =>
    withTestFilesystem(async (root) => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      const providerGlob = vi.fn();
      vi.doMock("node:fs/promises", () => ({ ...actual, glob: providerGlob }));
      vi.resetModules();
      const { createPluginContext: createContainedContext } = await import("./context.ts");
      const context = createContainedContext(root);
      const results = await Promise.all([
        context.glob(join(root, "**/*.md")),
        context.glob("../**"),
        context.glob("{docs,../outside}/**"),
      ]);

      expect(results).toEqual([
        {
          ok: false,
          error: {
            code: "source",
            message: "Glob pattern escapes project root",
            path: join(root, "**/*.md"),
          },
        },
        {
          ok: false,
          error: {
            code: "source",
            message: "Glob pattern escapes project root",
            path: "../**",
          },
        },
        {
          ok: false,
          error: {
            code: "source",
            message: "Glob pattern escapes project root",
            path: "{docs,../outside}/**",
          },
        },
      ]);
      expect(providerGlob).not.toHaveBeenCalled();
    }));

  it("rejects glob matches that resolve outside the project root", async () =>
    withTestFilesystem(async (temporary) => {
      const root = join(temporary, "project");
      const outside = join(temporary, "outside");
      await Promise.all([mkdir(root), writeTestFile(outside, "secret.md", "secret")]);
      await symlink(outside, join(root, "linked"));

      await expect(createPluginContext(root).glob("linked/**/*.md")).resolves.toMatchObject({
        ok: false,
        error: { message: "Path escapes project root" },
      });
    }));

  it("rejects out-of-root entries returned by the glob provider", async () =>
    withTestFilesystem(async (temporary) => {
      const root = join(temporary, "project");
      const outside = join(temporary, "outside");
      await Promise.all([mkdir(root), writeTestFile(outside, "secret.md", "secret")]);
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        glob: async function* () {
          yield { isFile: () => true, name: "secret.md", parentPath: outside };
          yield { isFile: () => true, name: "secret.md", parentPath: outside };
        },
      }));
      vi.resetModules();
      const { createPluginContext: createEscapingContext } = await import("./context.ts");

      await expect(createEscapingContext(root).glob("**/*.md")).resolves.toMatchObject({
        ok: false,
        error: { message: "Path escapes project root" },
      });
    }));

  it("contains glob canonicalization failures", async () =>
    withTestFilesystem(async (root) => {
      await expect(
        createPluginContext(join(root, "missing")).glob("**/*.md"),
      ).resolves.toMatchObject({
        ok: false,
        error: { code: "source" },
      });
    }));

  it("returns an empty walk for a missing directory", async () =>
    withTestFilesystem(async (root) => {
      await expect(createPluginContext(root).walk("missing")).resolves.toEqual({
        ok: true,
        value: [],
      });
    }));

  it("reads arbitrary bytes and permission metadata without decoding", async () =>
    withTestFilesystem(async (root) => {
      const fixture = new Uint8Array([0, 0xff, 0xfe, 65]);
      await writeTestBytes(root, "bin/tool", fixture, 0o751);
      await writeTestBytes(root, "bin/default-mode", fixture);
      const context = createPluginContext(root);

      await expect(context.readBytes("bin/tool")).resolves.toEqual({ ok: true, value: fixture });
      await expect(context.readFileRecord("bin/tool")).resolves.toEqual({
        ok: true,
        value: { content: fixture, mode: 0o751 },
      });
    }));

  it("rejects lexical and symlink escapes", async () =>
    withTestFilesystem(async (temporary) => {
      const root = join(temporary, "project");
      const outside = join(temporary, "outside");
      await Promise.all([mkdir(root), writeTestFile(outside, "secret.txt", "secret")]);
      await symlink(outside, join(root, "linked"));
      const context = createPluginContext(root);

      await expect(context.walk("../outside")).resolves.toMatchObject({
        ok: false,
        error: { message: "Path escapes project root" },
      });
      await expect(context.walk("linked")).resolves.toMatchObject({
        ok: false,
        error: { message: "Path escapes project root" },
      });
      await expect(context.read("linked/secret.txt")).resolves.toMatchObject({
        ok: false,
        error: { message: "Path escapes project root" },
      });
      await expect(context.read("../outside/secret.txt")).resolves.toMatchObject({
        ok: false,
        error: { message: "Path escapes project root" },
      });
      await expect(context.readBytes("linked/secret.txt")).resolves.toMatchObject({ ok: false });
      await expect(context.readFileRecord("../outside/secret.txt")).resolves.toMatchObject({
        ok: false,
      });
    }));

  it("contains read, walk, and glob filesystem failures", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "file.txt", "file");
      await mkdir(join(root, "directory"));
      const invalidPatterns = ["**/*", null] as unknown as readonly string[];
      const context = createPluginContext(root);

      await expect(context.read("missing.txt")).resolves.toMatchObject({ ok: false });
      await expect(context.read("directory")).resolves.toMatchObject({ ok: false });
      await expect(context.readBytes("missing.txt")).resolves.toMatchObject({ ok: false });
      await expect(context.readFileRecord("directory")).resolves.toMatchObject({ ok: false });
      await expect(context.walk("file.txt")).resolves.toMatchObject({ ok: false });
      await expect(context.glob(invalidPatterns)).resolves.toMatchObject({ ok: false });
    }));

  it("contains a byte read failure after containment succeeds", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "file.txt", "file");
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      vi.doMock("node:fs/promises", () => ({
        ...actual,
        readFile: async () => {
          throw new Error("read failed");
        },
      }));
      vi.resetModules();
      const { createPluginContext: createFaultingContext } = await import("./context.ts");

      await expect(createFaultingContext(root).readBytes("file.txt")).resolves.toMatchObject({
        ok: false,
        error: { message: "read failed" },
      });
    }));
});
