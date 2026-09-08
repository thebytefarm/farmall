import { describe, expect, it } from "vitest";

import { createPluginContext } from "../plugins/context.ts";
import { err, ok } from "../result.ts";
import { withTestFilesystem, writeTestFile } from "../test-filesystem.ts";
import type { CoreError, PluginContext } from "../types.ts";
import { platformIds } from "./platform-definitions.ts";
import { platformSourcePlugin } from "./platform-source.ts";

describe("platformSourcePlugin", () => {
  it("imports generic platform artifacts while preserving nested names", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "fixture/CLAUDE.md", "instructions"),
        writeTestFile(root, "fixture/.claude/rules/backend/typescript.md", "rule"),
        writeTestFile(root, "fixture/.claude/agents/research/scout.md", "scout"),
        writeTestFile(root, "fixture/.claude/skills/team/review/SKILL.md", "skill"),
        writeTestFile(root, "fixture/.claude/skills/team/review/.hidden/note.md", "note"),
        writeTestFile(root, "fixture/.claude/settings.json", "{}"),
      ]);
      const result = await platformSourcePlugin.run(
        { platform: "claude-code", root: "fixture" },
        createPluginContext(root),
      );
      expect(result).toMatchObject({
        ok: true,
        value: {
          value: [
            { kind: "instructions", name: "CLAUDE" },
            { kind: "rules", name: "backend/typescript" },
            { kind: "skills", name: "team/review" },
            { kind: "subagents", name: "research/scout" },
          ],
        },
      });
    }));

  it("maps every platform definition against an empty project", async () =>
    withTestFilesystem(async (root) => {
      const results = await Promise.all(
        platformIds().map((platform) =>
          platformSourcePlugin.run({ platform }, createPluginContext(root)),
        ),
      );
      expect(results.every((result) => result.ok)).toBe(true);
    }));

  it("accepts valid platform source options", () => {
    expect(platformSourcePlugin.validate?.({ platform: "cursor" })).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("imports Cursor project subagents", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, ".cursor/agents/research/scout.md", "scout");
      const result = await platformSourcePlugin.run(
        { platform: "cursor" },
        createPluginContext(root),
      );
      expect(result).toMatchObject({
        ok: true,
        value: { value: [{ kind: "subagents", name: "research/scout" }] },
      });
    }));

  it("imports each Windsurf file as only the first matching artifact kind", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, ".windsurf/rules/farmall.md", "instructions"),
        writeTestFile(root, ".windsurf/rules/backend.md", "rule"),
        writeTestFile(root, ".windsurf/skills/review/SKILL.md", "skill"),
      ]);
      const result = await platformSourcePlugin.run(
        { platform: "windsurf" },
        createPluginContext(root),
      );

      expect(result).toMatchObject({
        ok: true,
        value: {
          value: [
            { kind: "instructions", name: "farmall", source: ".windsurf/rules/farmall.md" },
            { kind: "rules", name: "backend", source: ".windsurf/rules/backend.md" },
            { kind: "skills", name: "review", source: ".windsurf/skills/review/SKILL.md" },
          ],
        },
      });
    }));

  it.each([
    ["missing platform", {}],
    ["unknown platform", { platform: "enterprise" }],
    ["platform type", { platform: 1 }],
    ["unsafe root", { platform: "codex", root: "../fixture" }],
    ["root type", { platform: "codex", root: 1 }],
    ["unknown key", { platform: "codex", extra: true }],
  ])("rejects invalid %s options", (_name, options) => {
    expect(platformSourcePlugin.validate?.(options)).toMatchObject({
      ok: false,
      error: { code: "plugin", plugin: "farmall:platform-source" },
    });
  });

  it("rejects malformed runtime options before discovery", async () => {
    await expect(
      platformSourcePlugin.run({}, createPluginContext("/unused")),
    ).resolves.toMatchObject({ ok: false, error: { code: "plugin" } });
  });

  it("propagates discovery, naming, and artifact failures", async () => {
    const sourceError = (path: string) => err<CoreError>({ code: "source", message: path, path });
    const base: PluginContext = {
      root: "/project",
      read: async () => ok("content"),
      readBytes: async () => ok(new TextEncoder().encode("content")),
      readFileRecord: async () => ok({ content: new TextEncoder().encode("content"), mode: 0o644 }),
      glob: async () => ok([]),
      walk: async () => ok([]),
    };
    const discovery: PluginContext = { ...base, glob: async () => sourceError("glob") };
    const invalidName: PluginContext = {
      ...base,
      glob: async (pattern) => {
        if (String(pattern).includes("rules")) return ok([".claude/rules/../outside.md"]);
        return ok([]);
      },
    };
    const artifactRead: PluginContext = {
      ...base,
      glob: async (pattern) => {
        if (String(pattern).includes("rules")) {
          return ok([".claude/rules/a.md", ".claude/rules/b.md"]);
        }
        return ok([]);
      },
      read: async (path) => sourceError(path),
      readBytes: async (path) => sourceError(path),
      readFileRecord: async (path) => sourceError(path),
    };
    const results = await Promise.all([
      platformSourcePlugin.run({ platform: "claude-code" }, discovery),
      platformSourcePlugin.run({ platform: "claude-code" }, invalidName),
      platformSourcePlugin.run({ platform: "claude-code" }, artifactRead),
    ]);
    expect(results.every((result) => !result.ok)).toBe(true);
  });
});
