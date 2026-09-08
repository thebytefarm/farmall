import { describe, expect, it } from "vitest";

import { defineConfig, farmallConfigSchema } from "./schema.ts";

const config = {
  pipelines: {
    default: {
      sources: [{ use: "farmall:source" }],
      outputs: [{ use: "farmall:codex" }],
    },
  },
} as const;

describe("defineConfig", () => {
  it("returns the exact config value", () => {
    expect(defineConfig(config)).toBe(config);
  });
});

describe("farmallConfigSchema", () => {
  it("accepts complete pipeline configuration", () => {
    expect(
      farmallConfigSchema.safeParse({
        ...config,
        state: ".state.json",
        plugins: ["test-plugin"],
        severity: { rule: "off" },
        pipelines: {
          default: {
            sources: [{ use: "source", name: "input", options: { enabled: true } }],
            transforms: [{ use: "transform" }],
            lint: [{ use: "lint" }],
            outputs: [{ use: "output" }],
          },
        },
      }).success,
    ).toBe(true);
  });

  it.each([
    {},
    { pipelines: { default: { sources: [], outputs: [{ use: "output" }] } } },
    { pipelines: { default: { sources: [{ use: "source" }], outputs: [] } } },
    { pipelines: { default: { sources: [{ use: "" }], outputs: [{ use: "output" }] } } },
    { ...config, extra: true },
  ])("rejects invalid configuration", (value) => {
    expect(farmallConfigSchema.safeParse(value).success).toBe(false);
  });
});
