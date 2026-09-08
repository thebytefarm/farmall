import { describe, expect, it } from "vitest";

import {
  FARMALL_VERSION,
  applyPlan,
  createPlan,
  createPluginContext,
  defineConfig,
  digest,
  initProject,
  isJsonValue,
  jsonObjectSchema,
  jsonValueSchema,
  loadConfig,
  loadManifest,
  loadPlugins,
  renderDiff,
  resolvePlugin,
  runPipeline,
} from "./index.ts";

describe("public planner exports", () => {
  it("preserves root planner and apply exports", () => {
    expect([
      applyPlan,
      createPlan,
      createPluginContext,
      defineConfig,
      digest,
      initProject,
      isJsonValue,
      jsonObjectSchema.safeParse,
      jsonValueSchema.safeParse,
      loadConfig,
      loadManifest,
      loadPlugins,
      renderDiff,
      resolvePlugin,
      runPipeline,
    ]).toEqual([
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    ]);
    expect(FARMALL_VERSION).toBe("0.0.2");
  });
});
