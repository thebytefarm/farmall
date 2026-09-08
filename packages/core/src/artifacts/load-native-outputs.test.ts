import { describe, expect, it } from "vitest";

import { err, ok } from "../result.ts";
import { createPluginContext } from "../plugins/context.ts";
import { withTestFilesystem, writeTestBytes } from "../test-filesystem.ts";
import type { CoreError, PluginContext } from "../types.ts";
import { loadNativeOutputs, validateOutputName } from "./load-native-outputs.ts";

const sourceError = (path: string) => err<CoreError>({ code: "source", message: path, path });

const context = (paths: readonly string[], read: PluginContext["read"]): PluginContext => ({
  root: "/project",
  glob: async () => ok([]),
  walk: async () => ok(paths),
  read,
  readBytes: async (path) => {
    const result = await read(path);
    if (!result.ok) return result;
    return ok(new TextEncoder().encode(result.value));
  },
  readFileRecord: async (path) => {
    const result = await read(path);
    if (!result.ok) return result;
    return ok({ content: new TextEncoder().encode(result.value), mode: 0o644 });
  },
});

describe("validateOutputName", () => {
  it("accepts identifiers and rejects empty and dot identifiers", () => {
    expect(validateOutputName("work-codex")).toEqual({ ok: true, value: "work-codex" });
    expect(validateOutputName("").ok).toBe(false);
    expect(validateOutputName(".").ok).toBe(false);
    expect(validateOutputName("..").ok).toBe(false);
  });
});

describe("loadNativeOutputs", () => {
  it("loads native output bytes and executable mode losslessly", async () =>
    withTestFilesystem(async (root) => {
      const fixture = new Uint8Array([0, 0xff, 0xfe, 65]);
      await writeTestBytes(root, "outputs/codex/bin/tool", fixture, 0o755);

      const result = await loadNativeOutputs(createPluginContext(root), "outputs");

      expect(result).toEqual({
        ok: true,
        value: [
          {
            type: "output",
            id: "output:outputs/codex/bin/tool",
            output: "codex",
            source: "outputs/codex/bin/tool",
            files: [{ path: "bin/tool", content: fixture, mode: 0o755 }],
          },
        ],
      });
    }));
  it("rejects unsafe source paths, output names, and missing destination paths", async () => {
    const results = await Promise.all([
      loadNativeOutputs(
        context(["outside/file.md"], async () => ok("x")),
        "outputs",
      ),
      loadNativeOutputs(
        context(["outputs/bad$name/file.md"], async () => ok("x")),
        "outputs",
      ),
      loadNativeOutputs(
        context(["outputs/codex"], async () => ok("x")),
        "outputs",
      ),
    ]);
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it("propagates walk and read failures and stops after the first read failure", async () => {
    const walkContext: PluginContext = {
      ...context([], async () => ok("x")),
      walk: async () => sourceError("walk"),
    };
    const results = await Promise.all([
      loadNativeOutputs(walkContext, "outputs"),
      loadNativeOutputs(
        context(["outputs/codex/a.md", "outputs/codex/b.md"], async (path) => sourceError(path)),
        "outputs",
      ),
    ]);
    expect(results.every((result) => !result.ok)).toBe(true);
  });
});
