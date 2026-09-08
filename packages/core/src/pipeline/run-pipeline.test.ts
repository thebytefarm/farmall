import { mkdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import type { FarmallConfig } from "./types.ts";
import { withTestFilesystem, writeTestFile } from "../test-filesystem.ts";
import { runPipeline } from "./run-pipeline.ts";

const validArtifact = `{ type: "artifact", id: "rules:input", kind: "rules", name: "input", source: "input.md", content: "hello", metadata: {}, files: [{ path: "input.md", content: "hello" }] }`;

const orchestrationModule = `
const diagnostic = (rule, severity, path) => ({ rule, severity, message: rule, path });
export const plugins = [
  { apiVersion: 1, id: "test:source", kind: "source", run: async () => ({ ok: true, value: { value: [${validArtifact}], diagnostics: [diagnostic("source/z", "info", "z.md")] } }) },
  { apiVersion: 1, id: "test:transform", kind: "transform", run: async (emissions, options) => ({ ok: true, value: { value: emissions.map((emission) => ({ ...emission, content: emission.content.toUpperCase() + options.suffix })), diagnostics: [diagnostic("transform/off", "warn", "a.md")] } }) },
  { apiVersion: 1, id: "test:lint", kind: "lint", run: async () => ({ ok: true, value: [diagnostic("lint/promote", "warn", "b.md")] }) },
  { apiVersion: 1, id: "test:output", kind: "output", run: async (emissions, options) => ({ ok: true, value: { value: [{ path: options.output + "/result.md", content: emissions[0].content, output: options.output, plugin: "test:output", sources: [emissions[0].id], writePolicy: "managed" }], diagnostics: [diagnostic("output/a", "info", "c.md")] } }) },
];`;

const configFor = (plugin: string): FarmallConfig => ({
  plugins: [plugin],
  severity: { "transform/off": "off", "lint/promote": "error" },
  pipelines: {
    default: {
      sources: [{ use: "test:source" }],
      transforms: [{ use: "test:transform", options: { suffix: "!" } }],
      lint: [{ use: "test:lint" }],
      outputs: [{ use: "test:output", name: "named" }],
    },
  },
});

describe("runPipeline", () => {
  it("orchestrates all stages, severity, and planning", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "plugins.mjs", orchestrationModule);

      const result = await runPipeline(root, configFor("./plugins.mjs"));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toMatchObject({
        pipeline: "default",
        emissions: [{ content: "HELLO!" }],
        desired: [{ path: "named/result.md", content: "HELLO!" }],
        diagnostics: [
          { rule: "lint/promote", severity: "error" },
          { rule: "output/a", severity: "info" },
          { rule: "source/z", severity: "info" },
        ],
        plan: { pipeline: "default", actions: [{ action: "create" }] },
      });
    }));

  it("rejects unknown pipelines and duplicate names", async () =>
    withTestFilesystem(async (root) => {
      const unknown = await runPipeline(root, { pipelines: {} });
      const duplicate = await runPipeline(root, {
        pipelines: {
          default: {
            sources: [{ use: "farmall:source", name: "same" }],
            transforms: [{ use: "farmall:lint", name: "same" }],
            outputs: [{ use: "farmall:codex" }],
          },
        },
      });

      expect(unknown).toMatchObject({ ok: false, error: { message: "Unknown pipeline: default" } });
      expect(duplicate).toMatchObject({
        ok: false,
        error: { message: "Duplicate plugin instance name: same" },
      });
    }));

  it("propagates plugin loading and planning failures", async () =>
    withTestFilesystem(async (root) => {
      const missing = await runPipeline(root, {
        plugins: ["./missing.mjs"],
        pipelines: {
          default: { sources: [{ use: "farmall:source" }], outputs: [{ use: "farmall:codex" }] },
        },
      });
      await mkdir(`${root}/.farmall-state.json`);
      const planning = await runPipeline(root, {
        pipelines: {
          default: {
            sources: [{ use: "farmall:source", options: { root: ".", outputs: false } }],
            outputs: [{ use: "farmall:codex" }],
          },
        },
      });

      expect(missing).toMatchObject({ ok: false, error: { code: "plugin" } });
      expect(planning).toMatchObject({ ok: false, error: { code: "plan" } });
    }));

  it.each([
    [
      "source",
      `{ ok: true, value: { value: [{ ...${validArtifact}, kind: "invalid" }], diagnostics: [] } }`,
    ],
    [
      "transform",
      `{ ok: true, value: { value: [{ type: "output", id: "bad", output: "bad", source: "source", files: [{ path: "../escape", content: "bad" }] }], diagnostics: [] } }`,
    ],
    ["lint", `{ ok: true, value: [{ rule: "bad", severity: "fatal", message: "bad" }] }`],
    [
      "output",
      `{ ok: true, value: { value: [{ path: "bad.md", content: "bad", output: "bad", plugin: "bad", sources: ["source"], writePolicy: "overwrite" }], diagnostics: [] } }`,
    ],
  ] as const)("rejects malformed JavaScript %s results", async (kind, resultSource) =>
    withTestFilesystem(async (root) => {
      const pluginId = `test:${kind}`;
      await writeTestFile(
        root,
        "malformed.mjs",
        `export default { apiVersion: 1, id: "${pluginId}", kind: "${kind}", run: async () => (${resultSource}) };`,
      );
      const stageUses = {
        sources: [{ use: "farmall:source", options: { outputs: false } }],
        transforms: [],
        lint: [],
        outputs: [{ use: "farmall:codex" }],
      };
      const keyedStages = {
        source: "sources",
        transform: "transforms",
        lint: "lint",
        output: "outputs",
      } as const;
      const configured = { ...stageUses, [keyedStages[kind]]: [{ use: pluginId }] };
      const run = await runPipeline(root, {
        plugins: ["./malformed.mjs"],
        pipelines: { default: configured },
      });

      expect(run).toMatchObject({
        ok: false,
        error: {
          code: "plugin",
          plugin: pluginId,
          message: expect.stringContaining("Invalid result"),
        },
      });
    }),
  );

  it("isolates upstream emissions and options from plugin mutation", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(
        root,
        "immutable.mjs",
        `export const plugins = [
          { apiVersion: 1, id: "test:source", kind: "source", run: async () => ({ ok: true, value: { value: [${validArtifact}], diagnostics: [] } }) },
          { apiVersion: 1, id: "test:transform", kind: "transform", run: async (emissions, options) => {
            try { emissions[0].content = "mutated"; } catch {}
            try { options.nested.value = "mutated"; } catch {}
            return { ok: true, value: { value: emissions, diagnostics: [] } };
          } },
          { apiVersion: 1, id: "test:lint", kind: "lint", run: async (emissions) => {
            try { emissions[0].content = "linted"; } catch {}
            return { ok: true, value: [] };
          } },
          { apiVersion: 1, id: "test:output", kind: "output", run: async (emissions) => {
            try { emissions[0].content = "output"; } catch {}
            return { ok: true, value: { value: [{ path: "result.md", content: emissions[0].content, output: "test", plugin: "test:output", sources: [emissions[0].id], writePolicy: "managed" }], diagnostics: [] } };
          } },
        ];`,
      );
      const options = { nested: { value: "original" } };

      const result = await runPipeline(root, {
        plugins: ["./immutable.mjs"],
        pipelines: {
          default: {
            sources: [{ use: "test:source" }],
            transforms: [{ use: "test:transform", options }],
            lint: [{ use: "test:lint" }],
            outputs: [{ use: "test:output" }],
          },
        },
      });

      expect(result).toMatchObject({
        ok: true,
        value: { emissions: [{ content: "hello" }], desired: [{ content: "hello" }] },
      });
      expect(options).toEqual({ nested: { value: "original" } });
    }));
});
