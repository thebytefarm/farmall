import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ok } from "../result.ts";
import { withTestFilesystem, writeTestFile } from "../test-filesystem.ts";
import type { SourcePlugin } from "./types.ts";
import { loadPlugins } from "./load-plugins.ts";

const sourcePlugin = (id: string): SourcePlugin => ({
  apiVersion: 1,
  id,
  kind: "source",
  run: async () => ok({ value: [], diagnostics: [] }),
});

const pluginSource = (id: string): string =>
  `export default { apiVersion: 1, id: "${id}", kind: "source", run: async () => ({ ok: true, value: { value: [], diagnostics: [] } }) };`;

describe("loadPlugins", () => {
  it("loads default, named-array, and absolute exports", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "plugins/default.mjs", pluginSource("test:default"));
      await writeTestFile(
        root,
        "plugins/named.mjs",
        `export const plugins = [${pluginSource("test:named").replace("export default ", "").replace(";", "")}];`,
      );

      const result = await loadPlugins(
        root,
        [sourcePlugin("test:builtin")],
        ["./plugins/default.mjs", join(root, "plugins/named.mjs")],
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.map((plugin) => plugin.id)).toEqual([
        "test:builtin",
        "test:default",
        "test:named",
      ]);
    }));

  it("resolves package import conditions from the config root", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(
        root,
        "node_modules/test-plugin/package.json",
        JSON.stringify({
          name: "test-plugin",
          type: "module",
          exports: { import: "./import.js", require: "./require.cjs" },
        }),
      );
      await writeTestFile(root, "node_modules/test-plugin/import.js", pluginSource("test:package"));
      await writeTestFile(
        root,
        "node_modules/test-plugin/require.cjs",
        'throw new Error("wrong condition")',
      );

      const result = await loadPlugins(root, [], ["test-plugin"]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.map((plugin) => plugin.id)).toEqual(["test:package"]);
    }));

  it("reloads changed plugin modules without stale cache", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "plugin.mjs", pluginSource("test:first"));
      const first = await loadPlugins(root, [], ["./plugin.mjs"]);
      await writeTestFile(root, "plugin.mjs", pluginSource("test:second"));

      const second = await loadPlugins(root, [], ["./plugin.mjs"]);

      expect(first.ok && first.value[0]?.id).toBe("test:first");
      expect(second.ok && second.value[0]?.id).toBe("test:second");
    }));

  it("rejects missing, invalid, and duplicate modules", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "invalid.mjs", "export default { id: 'invalid' };");
      await writeTestFile(root, "duplicate.mjs", pluginSource("test:same"));

      const missing = await loadPlugins(root, [], ["./missing.mjs", "./also-missing.mjs"]);
      const invalid = await loadPlugins(root, [], ["./invalid.mjs"]);
      const duplicate = await loadPlugins(root, [sourcePlugin("test:same")], ["./duplicate.mjs"]);

      expect(missing).toMatchObject({ ok: false, error: { plugin: "./missing.mjs" } });
      expect(invalid).toMatchObject({
        ok: false,
        error: { message: "Module exports no Farmall plugins" },
      });
      expect(duplicate).toMatchObject({
        ok: false,
        error: { message: "Duplicate plugin id: test:same" },
      });
    }));

  it("filters malformed values around valid exports", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(
        root,
        "mixed.mjs",
        `export default null;
export const plugins = [
  false,
  { apiVersion: 2, id: "bad-version", kind: "source", run() {} },
  { apiVersion: 1, id: 42, kind: "source", run() {} },
  { apiVersion: 1, id: "bad-kind", kind: "unknown", run() {} },
  { apiVersion: 1, id: "bad-run", kind: "source" },
  { apiVersion: 1, id: "test:valid", kind: "source", run: async () => ({ ok: true, value: { value: [], diagnostics: [] } }) },
];`,
      );

      const result = await loadPlugins(root, [], ["./mixed.mjs"]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.map((plugin) => plugin.id)).toEqual(["test:valid"]);
    }));
});
