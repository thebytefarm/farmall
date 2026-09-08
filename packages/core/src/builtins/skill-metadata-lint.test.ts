import { describe, expect, it } from "vitest";

import { createPluginContext } from "../plugins/context.ts";
import type { Artifact } from "../types.ts";
import { skillMetadataLintPlugin } from "./skill-metadata-lint.ts";

const skill = (
  metadata: Readonly<Record<string, unknown>>,
  source = "skills/review/SKILL.md",
): Artifact => ({
  type: "artifact",
  id: "skills:review",
  kind: "skills",
  name: "review",
  source,
  content: "skill",
  metadata,
  files: [{ path: "SKILL.md", content: "skill" }],
});

describe("skillMetadataLintPlugin", () => {
  it("reports required metadata, description length, and selected-platform drift", async () => {
    const result = await skillMetadataLintPlugin.run(
      [skill({ description: "x".repeat(1025), extension: true })],
      { platforms: ["codex"] },
      createPluginContext("/unused"),
    );
    expect(result).toMatchObject({
      ok: true,
      value: [
        { rule: "agent-skills/frontmatter" },
        { rule: "agent-skills/trigger-compat" },
        { rule: "agent-skills/frontmatter-drift", plugin: "farmall:codex" },
      ],
    });
  });

  it("accepts compatible metadata and checks every platform by default", async () => {
    expect(skillMetadataLintPlugin.validate?.({ platforms: ["opencode"] })).toEqual({
      ok: true,
      value: undefined,
    });
    await expect(
      skillMetadataLintPlugin.run(
        [skill({ name: "review", description: "Reviews code" })],
        {},
        createPluginContext("/unused"),
      ),
    ).resolves.toEqual({ ok: true, value: [] });
    const drift = await skillMetadataLintPlugin.run(
      [skill({ name: "review", description: "Reviews code", extension: true })],
      {},
      createPluginContext("/unused"),
    );
    expect(drift.ok && drift.value.length).toBeGreaterThan(0);
  });

  it.each([
    ["license", "MIT"],
    ["compatibility", "Requires git"],
    ["metadata", { owner: "platform" }],
    ["allowed-tools", "Read Grep"],
  ])("accepts the optional standard field %s for Claude Code", async (field, value) => {
    await expect(
      skillMetadataLintPlugin.run(
        [skill({ name: "review", description: "Reviews code", [field]: value })],
        { platforms: ["claude-code"] },
        createPluginContext("/unused"),
      ),
    ).resolves.toEqual({ ok: true, value: [] });
  });

  it.each([
    ["claude-code", "when_to_use", "During review", "cursor-only", true],
    ["cursor", "paths", "src/**", "allowed-tools", "Read"],
    ["codex", "compatibility", "Requires git", "paths", true],
    ["copilot", "argument-hint", "[pull-request]", "paths", true],
    ["opencode", "metadata", { owner: "platform" }, "allowed-tools", "Read"],
    ["windsurf", "compatibility", "Requires git", "paths", true],
    ["devin", "triggers", ["user"], "metadata", { owner: "platform" }],
    ["pi", "disable-model-invocation", true, "paths", true],
  ])(
    "recognizes documented %s fields and warns for ignored fields",
    async (platform, recognizedField, recognizedValue, ignoredField, ignoredValue) => {
      const result = await skillMetadataLintPlugin.run(
        [
          skill({
            name: "review",
            description: "Reviews code",
            [recognizedField]: recognizedValue,
            [ignoredField]: ignoredValue,
          }),
        ],
        { platforms: [platform] },
        createPluginContext("/unused"),
      );
      expect(result).toMatchObject({
        ok: true,
        value: [
          {
            rule: "agent-skills/frontmatter-drift",
            plugin: `farmall:${platform}`,
            message: `${platform} ignores skill field ${ignoredField}`,
          },
        ],
      });
    },
  );

  it("accepts OpenCode metadata", async () => {
    await expect(
      skillMetadataLintPlugin.run(
        [
          skill({
            name: "review",
            description: "Reviews code",
            metadata: { owner: "platform", version: "1" },
          }),
        ],
        { platforms: ["opencode"] },
        createPluginContext("/unused"),
      ),
    ).resolves.toEqual({ ok: true, value: [] });
  });

  it("accepts standard field length boundaries", async () => {
    await expect(
      skillMetadataLintPlugin.run(
        [
          skill({
            name: "review",
            description: "x".repeat(1024),
            compatibility: "x".repeat(500),
            metadata: {},
          }),
        ],
        { platforms: ["claude-code"] },
        createPluginContext("/unused"),
      ),
    ).resolves.toEqual({ ok: true, value: [] });
  });

  it.each([
    ["one character", "a", "skills/a/SKILL.md"],
    ["64 characters", "a".repeat(64), `nested/skill-roots/${"a".repeat(64)}/SKILL.md`],
  ])("accepts a valid name at the %s boundary", async (_case, name, source) => {
    await expect(
      skillMetadataLintPlugin.run(
        [skill({ name, description: "Reviews code" }, source)],
        { platforms: ["codex"] },
        createPluginContext("/unused"),
      ),
    ).resolves.toEqual({ ok: true, value: [] });
  });

  it.each([
    ["empty", "", "skills/review/SKILL.md"],
    ["whitespace", " ", "skills/review/SKILL.md"],
    ["65 characters", "a".repeat(65), `skills/${"a".repeat(65)}/SKILL.md`],
    ["uppercase", "Review", "skills/Review/SKILL.md"],
    ["leading hyphen", "-review", "skills/-review/SKILL.md"],
    ["trailing hyphen", "review-", "skills/review-/SKILL.md"],
    ["consecutive hyphens", "code--review", "skills/code--review/SKILL.md"],
    ["underscore", "code_review", "skills/code_review/SKILL.md"],
    ["directory mismatch", "review", "nested/skill-roots/audit/SKILL.md"],
  ])("rejects an invalid skill name: %s", async (_case, name, source) => {
    const result = await skillMetadataLintPlugin.run(
      [skill({ name, description: "Reviews code" }, source)],
      { platforms: ["codex"] },
      createPluginContext("/unused"),
    );
    expect(result).toMatchObject({
      ok: true,
      value: [{ rule: "agent-skills/frontmatter", severity: "error" }],
    });
  });

  it.each([
    ["name type", { name: 1, description: "Reviews code" }],
    ["description type", { name: "review", description: true }],
    ["description empty", { name: "review", description: "" }],
    ["description whitespace", { name: "review", description: " " }],
    ["license type", { license: 1 }],
    ["allowed-tools type", { "allowed-tools": ["Read"] }],
    ["compatibility type", { compatibility: true }],
    ["compatibility empty", { compatibility: "" }],
    ["compatibility whitespace", { compatibility: " " }],
    ["compatibility length", { compatibility: "x".repeat(501) }],
    ["metadata type", { metadata: "owner=platform" }],
    ["metadata null", { metadata: null }],
    ["metadata array", { metadata: ["platform"] }],
    ["metadata value", { metadata: { owner: 1 } }],
  ])("rejects invalid optional metadata: %s", async (_name, metadata) => {
    const result = await skillMetadataLintPlugin.run(
      [skill({ name: "review", description: "Reviews code", ...metadata })],
      { platforms: ["claude-code"] },
      createPluginContext("/unused"),
    );
    expect(result).toMatchObject({ ok: true, value: [{ rule: "agent-skills/frontmatter" }] });
  });

  it.each([
    ["platforms type", { platforms: "codex" }],
    ["empty platforms", { platforms: [] }],
    ["unknown platform", { platforms: ["enterprise"] }],
    ["unknown key", { extra: true }],
  ])("rejects invalid %s options", (_name, options) => {
    expect(skillMetadataLintPlugin.validate?.(options)).toMatchObject({
      ok: false,
      error: { code: "plugin", plugin: "farmall:lint" },
    });
  });

  it("rejects malformed runtime options and ignores non-skill emissions", async () => {
    await expect(
      skillMetadataLintPlugin.run([], { platforms: [] }, createPluginContext("/unused")),
    ).resolves.toMatchObject({ ok: false, error: { code: "plugin" } });
    await expect(
      skillMetadataLintPlugin.run(
        [{ ...skill({}), kind: "rules" }],
        {},
        createPluginContext("/unused"),
      ),
    ).resolves.toEqual({ ok: true, value: [] });
  });
});
