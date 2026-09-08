import { describe, expect, it } from "vitest";

import { createPluginContext } from "../plugins/context.ts";
import type { Artifact, DirectOutput, Emission, OutputPlugin } from "../types.ts";
import { BUILTIN_PLUGINS, builtInOutput, stage } from "./index.ts";
import {
  PLATFORM_DEFINITIONS,
  PLATFORM_DEFINITION_BY_ID,
  platformDefinition,
  platformIds,
} from "./platform-definitions.ts";
import { filesystemOutputPlugin } from "./platform-output.ts";

const artifact = (overrides: Partial<Artifact> = {}): Artifact => ({
  type: "artifact",
  id: "skills:review",
  kind: "skills",
  name: "team/review",
  source: "skills/team/review/SKILL.md",
  content: "skill",
  metadata: { name: "team/review", description: "Reviews code" },
  files: [{ path: "SKILL.md", content: "skill" }],
  ...overrides,
});

const outputPlugin = (id: string): OutputPlugin => {
  const plugin = builtInOutput(id);
  if (plugin?.kind === "output") return plugin;
  throw new Error(`Missing output plugin: ${id}`);
};

const unsafeEmissions: readonly (readonly [string, Emission])[] = [
  ["artifact name", artifact({ name: "../review" })],
  ["artifact source", artifact({ source: "../SKILL.md" })],
  ["artifact file", artifact({ files: [{ path: "../SKILL.md", content: "skill" }] })],
  [
    "direct output",
    {
      type: "output",
      id: "bad",
      output: "../codex",
      source: "bad",
      files: [{ path: "config", content: "x" }],
    },
  ],
  [
    "direct path",
    {
      type: "output",
      id: "bad",
      output: "codex",
      source: "bad",
      files: [{ path: "../config", content: "x" }],
    },
  ],
];

describe("platform output plugins", () => {
  it("renders nested artifacts, direct outputs, roots, names, and write policies", async () => {
    const direct: DirectOutput = {
      type: "output",
      id: "output:codex",
      output: "work-codex",
      source: "native",
      files: [{ path: ".codex/config.toml", content: "model = 'x'" }],
    };
    const result = await outputPlugin("codex").run(
      [artifact(), direct],
      { output: "work-codex", root: "generated", writePolicy: "create-only" },
      createPluginContext("/unused"),
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        value: [
          { path: "generated/.agents/skills/team/review/SKILL.md", writePolicy: "create-only" },
          { path: "generated/.codex/config.toml", output: "work-codex" },
        ],
      },
    });
  });

  it("writes the canonical filesystem layout with default options", async () => {
    const result = await filesystemOutputPlugin.run(
      [
        artifact({
          kind: "instructions",
          name: "AGENTS",
          source: "AGENTS.md",
          content: "instructions",
        }),
        artifact({
          kind: "rules",
          name: "backend/typescript",
          source: "rules/backend/typescript.md",
          content: "rule",
        }),
        artifact(),
        artifact({
          kind: "subagents",
          name: "research/scout",
          source: "subagents/research/scout.md",
          content: "scout",
        }),
      ],
      {},
      createPluginContext("/unused"),
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        value: [
          { path: "agent-config/AGENTS.md" },
          { path: "agent-config/rules/backend/typescript.md" },
          { path: "agent-config/skills/team/review/SKILL.md" },
          { path: "agent-config/subagents/research/scout.md" },
        ],
      },
    });
  });

  it("supports valid path overrides and reports unsupported artifacts", async () => {
    const rules = artifact({ kind: "rules", name: "one", source: "rules/one.md", content: "rule" });
    const unsupported = await outputPlugin("codex").run(
      [rules],
      {},
      createPluginContext("/unused"),
    );
    const overridden = await outputPlugin("codex").run(
      [rules],
      { paths: { rules: "custom/{name}.md" } },
      createPluginContext("/unused"),
    );
    expect(unsupported).toMatchObject({
      ok: true,
      value: { value: [], diagnostics: [{ rule: "farmall/unsupported-artifact" }] },
    });
    expect(overridden).toMatchObject({
      ok: true,
      value: { value: [{ path: "custom/one.md" }], diagnostics: [] },
    });
  });

  it("uses current OpenCode and Cursor artifact mappings", async () => {
    const rules = artifact({ kind: "rules", name: "one", source: "rules/one.md", content: "rule" });
    const subagent = artifact({
      kind: "subagents",
      name: "review",
      source: "subagents/review.md",
      content: "review",
    });
    const [opencode, cursor] = await Promise.all([
      outputPlugin("opencode").run([rules], {}, createPluginContext("/unused")),
      outputPlugin("cursor").run([subagent], {}, createPluginContext("/unused")),
    ]);
    expect(opencode).toMatchObject({
      ok: true,
      value: { value: [], diagnostics: [{ rule: "farmall/unsupported-artifact" }] },
    });
    expect(cursor).toMatchObject({
      ok: true,
      value: { value: [{ path: ".cursor/agents/review.md" }], diagnostics: [] },
    });
  });

  it.each([
    ["license", "license: MIT"],
    ["compatibility", "compatibility: Requires git"],
    ["metadata", "metadata:\n  owner: platform"],
    ["allowed-tools", "allowed-tools: Read Grep"],
  ])("preserves the optional standard skill field %s on every platform", async (_field, yaml) => {
    const content = `---\nname: review\ndescription: Reviews code\n${yaml}\n---\nskill`;
    const results = await Promise.all(
      platformIds().map((id) =>
        outputPlugin(id).run(
          [artifact({ content, files: [{ path: "SKILL.md", content }] })],
          {},
          createPluginContext("/unused"),
        ),
      ),
    );
    expect(results.every((result) => result.ok && result.value.value[0]?.content === content)).toBe(
      true,
    );
  });

  it.each([
    ["root type", { root: 1 }],
    ["unsafe root", { root: "../generated" }],
    ["paths root", { paths: [] }],
    ["path type", { paths: { rules: 1 } }],
    ["unsafe path", { paths: { rules: "../{name}.md" } }],
    ["output type", { output: 1 }],
    ["unsafe output", { output: "team/codex" }],
    ["write policy", { writePolicy: "overwrite" }],
    ["unknown key", { extra: true }],
  ])("rejects invalid %s options", (_name, options) => {
    expect(outputPlugin("codex").validate?.(options)).toMatchObject({
      ok: false,
      error: { code: "plugin", plugin: "farmall:codex" },
    });
  });

  it.each(unsafeEmissions)("rejects unsafe emitted %s paths", async (_name, emission) => {
    await expect(
      outputPlugin("codex").run([emission], {}, createPluginContext("/unused")),
    ).resolves.toMatchObject({ ok: false, error: { code: "plugin" } });
  });

  it("rejects malformed runtime options before claiming an empty desired set", async () => {
    await expect(
      outputPlugin("codex").run([], { paths: [] }, createPluginContext("/unused")),
    ).resolves.toMatchObject({ ok: false, error: { code: "plugin" } });
  });

  it("ignores valid direct outputs claimed by a different output name", async () => {
    const direct: DirectOutput = {
      type: "output",
      id: "other",
      output: "other",
      source: "native",
      files: [{ path: "config.toml", content: "x" }],
    };
    await expect(
      outputPlugin("codex").run([direct], {}, createPluginContext("/unused")),
    ).resolves.toEqual({ ok: true, value: { value: [], diagnostics: [] } });
  });

  it("stops artifact and direct rendering after the first unsafe file", async () => {
    const brokenSkill = artifact({
      files: [
        { path: "../bad", content: "bad" },
        { path: "SKILL.md", content: "skill" },
      ],
    });
    const brokenDirect: DirectOutput = {
      type: "output",
      id: "broken",
      output: "codex",
      source: "native",
      files: [
        { path: "../bad", content: "bad" },
        { path: "config.toml", content: "x" },
      ],
    };
    const results = await Promise.all([
      outputPlugin("codex").run([brokenSkill, artifact()], {}, createPluginContext("/unused")),
      outputPlugin("codex").run([brokenDirect], {}, createPluginContext("/unused")),
    ]);
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it("exposes stable built-in aliases and helpers", () => {
    expect(platformIds()).toEqual([
      "claude-code",
      "cursor",
      "codex",
      "copilot",
      "opencode",
      "windsurf",
      "devin",
      "pi",
    ]);
    expect(platformIds().every((id) => builtInOutput(id)?.kind === "output")).toBe(true);
    expect(outputPlugin("codex").validate?.({})).toEqual({ ok: true, value: undefined });
    expect(PLATFORM_DEFINITIONS).toEqual(platformIds().map((id) => PLATFORM_DEFINITION_BY_ID[id]));
    expect(
      platformIds().every((id) => platformDefinition(id) === PLATFORM_DEFINITION_BY_ID[id]),
    ).toBe(true);
    expect(Object.isFrozen(PLATFORM_DEFINITION_BY_ID)).toBe(true);
    expect(Object.isFrozen(PLATFORM_DEFINITION_BY_ID.cursor.paths)).toBe(true);
    expect(
      platformIds().every((id) => builtInOutput(id)?.validate?.({ unknown: true }).ok === false),
    ).toBe(true);
    expect(builtInOutput("filesystem")).toBe(filesystemOutputPlugin);
    expect(builtInOutput("filesystem-source")).toBeUndefined();
    expect(builtInOutput("skill-metadata-lint")).toBeUndefined();
    expect(builtInOutput("unknown")).toBeUndefined();
    expect(BUILTIN_PLUGINS).toHaveLength(12);
    expect(stage("value")).toEqual({ value: "value", diagnostics: [] });
    expect(stage("value", [{ rule: "test", severity: "info", message: "test" }])).toMatchObject({
      diagnostics: [{ rule: "test" }],
    });
  });
});
