import { describe, expect, it } from "vitest";

import { createPluginContext } from "../plugins/context.ts";
import { err, ok } from "../result.ts";
import { withTestFilesystem, writeTestBytes, writeTestFile } from "../test-filesystem.ts";
import type { CoreError, PluginContext } from "../types.ts";
import { filesystemSourcePlugin } from "./filesystem-source.ts";

const sourceError = (path: string) => err<CoreError>({ code: "source", message: path, path });
const bytes = async () => ok(new TextEncoder().encode("content"));
const record = async () => ok({ content: new TextEncoder().encode("content"), mode: 0o644 });

describe("filesystemSourcePlugin", () => {
  it("loads normalized artifacts, hidden skill files, and native outputs", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "agent-config/AGENTS.md", "instructions"),
        writeTestFile(root, "agent-config/rules/backend/typescript.md", "rule"),
        writeTestFile(root, "agent-config/subagents/research/scout.md", "scout"),
        writeTestFile(
          root,
          "agent-config/skills/review/SKILL.md",
          "---\nname: code-review\ndescription: Reviews code\n---\nReview.",
        ),
        writeTestFile(root, "agent-config/skills/review/.hidden/config.json", "{}"),
        writeTestFile(root, "agent-config/skills/review/references/.internal/note.md", "note"),
        writeTestBytes(
          root,
          "agent-config/skills/review/bin/tool",
          new Uint8Array([0, 0xff, 65]),
          0o755,
        ),
        writeTestFile(root, "agent-config/outputs/codex/.codex/config.toml", "model = 'x'"),
      ]);

      const result = await filesystemSourcePlugin.run({}, createPluginContext(root));

      expect(result).toMatchObject({ ok: true, value: { diagnostics: [] } });
      if (!result.ok) return;
      expect(result.value.value.map((emission) => emission.id)).toEqual([
        "instructions:agent-config/AGENTS.md",
        "rules:agent-config/rules/backend/typescript.md",
        "skills:agent-config/skills/review/SKILL.md",
        "subagents:agent-config/subagents/research/scout.md",
        "output:agent-config/outputs/codex/.codex/config.toml",
      ]);
      expect(result.value.value[2]).toMatchObject({
        name: "code-review",
        files: [
          { path: ".hidden/config.json" },
          { path: "SKILL.md" },
          { path: "bin/tool", content: new Uint8Array([0, 0xff, 65]), mode: 0o755 },
          { path: "references/.internal/note.md" },
        ],
      });
    }));

  it("uses defaults only when options are absent and accepts complete custom options", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "custom/include.txt", "rule"),
        writeTestFile(root, "custom/native/codex/config.toml", "model = 'x'"),
      ]);
      const result = await filesystemSourcePlugin.run(
        {
          root: "custom",
          patterns: { instructions: [], rules: ["include.txt"], skills: [], subagents: [] },
          outputs: "native",
        },
        createPluginContext(root),
      );
      expect(result).toMatchObject({
        ok: true,
        value: { value: [{ kind: "rules", name: "include" }, { output: "codex" }] },
      });
      await expect(
        filesystemSourcePlugin.run({ outputs: false }, createPluginContext(root)),
      ).resolves.toEqual({ ok: true, value: { value: [], diagnostics: [] } });
    }));

  it("accepts the project root explicitly", () => {
    expect(filesystemSourcePlugin.validate?.({ root: ".", outputs: false })).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("uses default patterns for omitted kinds in a supplied pattern object", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "agent-config/AGENTS.md", "instructions");
      const result = await filesystemSourcePlugin.run(
        { patterns: { rules: [] }, outputs: false },
        createPluginContext(root),
      );
      expect(result).toMatchObject({ ok: true, value: { value: [{ kind: "instructions" }] } });
    }));

  it.each([
    ["root type", { root: 1 }],
    ["unsafe root", { root: "../agent-config" }],
    ["patterns root", { patterns: [] }],
    ["pattern type", { patterns: { rules: "rules/*.md" } }],
    ["unsafe pattern", { patterns: { rules: ["../rules/*.md"] } }],
    ["outputs type", { outputs: 1 }],
    ["unsafe outputs", { outputs: "/native" }],
    ["unknown key", { extra: true }],
  ])("rejects invalid %s options", (_name, options) => {
    expect(filesystemSourcePlugin.validate?.(options)).toMatchObject({
      ok: false,
      error: { code: "plugin", plugin: "farmall:source" },
    });
  });

  it("rejects unsafe skill frontmatter names instead of repairing them", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(
        root,
        "agent-config/skills/review/SKILL.md",
        "---\nname: ../review\n---\n",
      );
      await expect(
        filesystemSourcePlugin.run({}, createPluginContext(root)),
      ).resolves.toMatchObject({ ok: false, error: { code: "source" } });
    }));

  it("propagates discovery, walk, and read failures", async () => {
    const discovery: PluginContext = {
      root: "/project",
      glob: async () => sourceError("glob"),
      walk: async () => ok([]),
      read: async () => ok("content"),
      readBytes: bytes,
      readFileRecord: record,
    };
    const artifactRead: PluginContext = {
      root: "/project",
      glob: async () => ok(["agent-config/AGENTS.md"]),
      walk: async () => ok([]),
      read: async (path) => sourceError(path),
      readBytes: async (path) => sourceError(path),
      readFileRecord: async (path) => sourceError(path),
    };
    const skillWalk: PluginContext = {
      root: "/project",
      glob: async (patterns) => {
        if (String(patterns).includes("skills")) return ok(["agent-config/skills/review/SKILL.md"]);
        return ok([]);
      },
      walk: async () => sourceError("walk"),
      read: async () => ok("skill"),
      readBytes: bytes,
      readFileRecord: record,
    };
    const nativeWalk: PluginContext = {
      root: "/project",
      glob: async () => ok([]),
      walk: async () => sourceError("walk"),
      read: async () => ok("content"),
      readBytes: bytes,
      readFileRecord: record,
    };
    const nativeRead: PluginContext = {
      root: "/project",
      glob: async () => ok([]),
      walk: async () => ok(["agent-config/outputs/codex/a.md"]),
      read: async (path) => sourceError(path),
      readBytes: async (path) => sourceError(path),
      readFileRecord: async (path) => sourceError(path),
    };
    const results = await Promise.all([
      filesystemSourcePlugin.run({}, discovery),
      filesystemSourcePlugin.run({}, artifactRead),
      filesystemSourcePlugin.run({}, skillWalk),
      filesystemSourcePlugin.run({}, nativeWalk),
      filesystemSourcePlugin.run({}, nativeRead),
      filesystemSourcePlugin.run({ root: 1 }, nativeRead),
    ]);
    expect(results.every((result) => !result.ok)).toBe(true);
  });
});
