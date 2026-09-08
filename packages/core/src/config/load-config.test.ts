import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { withTestFilesystem, writeTestFile } from "../test-filesystem.ts";
import { loadConfig, selectConfigPath } from "./load-config.ts";

const configValue = {
  state: ".state.json",
  pipelines: {
    default: {
      sources: [{ use: "farmall:source" }],
      outputs: [{ use: "farmall:codex" }],
    },
  },
} as const;

describe("loadConfig", () => {
  it("rejects config selections without paths", () => {
    expect(selectConfigPath({ directory: "/repo", paths: [] })).toEqual({
      ok: false,
      error: { code: "config", message: "No Farmall config found", path: "/repo" },
    });
  });

  it.each([
    ["farmall.config.json", JSON.stringify(configValue)],
    [
      "farmall.config.jsonc",
      `{
        // URLs and comment-like strings must survive parsing.
        "state": "https://example.com/a/*literal*/", 
        "pipelines": {
          "default": {
            "sources": [{ "use": "farmall:source" }],
            "outputs": [{ "use": "farmall:codex" }],
          },
        },
      }`,
    ],
    [
      "farmall.config.yaml",
      "state: .state.json\npipelines:\n  default:\n    sources:\n      - use: farmall:source\n    outputs:\n      - use: farmall:codex\n",
    ],
    [
      "farmall.config.yml",
      "state: .state.json\npipelines:\n  default:\n    sources: [{ use: farmall:source }]\n    outputs: [{ use: farmall:codex }]\n",
    ],
    ["farmall.config.mjs", `export default ${JSON.stringify(configValue)}`],
    ["farmall.config.js", `module.exports = ${JSON.stringify(configValue)}`],
    ["farmall.config.ts", `export default ${JSON.stringify(configValue)} as const`],
  ])("loads %s", async (name, content) =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, name, content);

      const result = await loadConfig(root);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.path).toBe(join(root, name));
      if (name === "farmall.config.jsonc") {
        expect(result.value.config.state).toBe("https://example.com/a/*literal*/");
        return;
      }
      expect(result.value.config).toEqual(configValue);
    }),
  );

  it("discovers parent configs and resolves explicit paths", async () =>
    withTestFilesystem(async (root) => {
      const nested = join(root, "packages", "app", "src");
      await mkdir(nested, { recursive: true });
      await writeTestFile(root, "farmall.config.json", JSON.stringify(configValue));
      await writeTestFile(root, "config/custom.json", JSON.stringify(configValue));

      const discovered = await loadConfig(nested);
      const explicit = await loadConfig(root, "config/custom.json");

      expect(discovered).toMatchObject({ ok: true, value: { root } });
      expect(explicit).toMatchObject({ ok: true, value: { root: join(root, "config") } });
    }));

  it("does not reuse stale script modules", async () =>
    withTestFilesystem(async (root) => {
      const path = "farmall.config.mjs";
      await writeTestFile(root, path, `export default ${JSON.stringify(configValue)}`);
      const first = await loadConfig(root);
      await writeTestFile(
        root,
        path,
        `export default ${JSON.stringify({ ...configValue, state: ".changed.json" })}`,
      );

      const second = await loadConfig(root);

      expect(first).toMatchObject({ ok: true, value: { config: { state: ".state.json" } } });
      expect(second).toMatchObject({ ok: true, value: { config: { state: ".changed.json" } } });
    }));

  it("rejects multiple discovered configs", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "farmall.config.json", JSON.stringify(configValue)),
        writeTestFile(root, "farmall.config.yaml", "pipelines: {}\n"),
      ]);

      const result = await loadConfig(root);

      expect(result).toMatchObject({
        ok: false,
        error: { code: "config", path: root, message: expect.stringContaining("Multiple") },
      });
    }));

  it.each([
    ["missing.json", ""],
    ["malformed.json", "{"],
    ["malformed.jsonc", "{ trailing:"],
    ["invalid.json", JSON.stringify({ pipelines: { default: {} } })],
    ["empty.mjs", "export const config = {};"],
    ["throws.mjs", 'throw new Error("config reactor breach")'],
  ])("returns config errors for %s", async (path, content) =>
    withTestFilesystem(async (root) => {
      if (content.length > 0) await writeTestFile(root, path, content);

      const result = await loadConfig(root, path);

      expect(result).toMatchObject({
        ok: false,
        error: { code: "config", path: join(root, path) },
      });
    }),
  );

  it("reports when discovery reaches the filesystem root", async () =>
    withTestFilesystem(async (root) => {
      const result = await loadConfig(root);

      expect(result).toMatchObject({
        ok: false,
        error: { code: "config", message: "No Farmall config found" },
      });
    }));

  it.runIf(process.platform !== "win32")(
    "distinguishes discovery permission failures from missing configs",
    async () =>
      withTestFilesystem(async (root) => {
        const blocked = join(root, "blocked");
        await mkdir(blocked);
        await chmod(blocked, 0o000);
        const result = await loadConfig(blocked);
        await chmod(blocked, 0o700);

        expect(result).toMatchObject({ ok: false, error: { code: "config" } });
        if (result.ok) return;
        expect(result.error.message).not.toBe("No Farmall config found");
      }),
  );
});
