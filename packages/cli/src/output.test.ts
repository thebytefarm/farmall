import type { ApplyResult, PipelineRun } from "@farmall/core";
import { describe, expect, it, vi } from "vitest";

import { renderApplied, renderJson, renderRun } from "./output.ts";

describe("renderRun", () => {
  it("renders diagnostics, actions, reasons, and the summary", () => {
    const run: PipelineRun = {
      pipeline: "default",
      emissions: [],
      desired: [],
      diagnostics: [
        {
          rule: "agent-skills/frontmatter",
          severity: "error",
          message: "Missing name",
          path: "agent-config/skills/demo/SKILL.md",
        },
        { rule: "farmall/info", severity: "info", message: "Ready" },
      ],
      plan: {
        root: "/repo",
        statePath: ".farmall-state.json",
        actions: [
          {
            action: "conflict",
            path: "CLAUDE.md",
            output: "claude-code",
            after: "generated",
            reason: "destination is not managed by Farmall",
            desired: {
              path: "CLAUDE.md",
              output: "claude-code",
              plugin: "farmall:claude-code",
              sources: ["instructions:AGENTS.md"],
              writePolicy: "managed",
              content: "generated",
            },
          },
        ],
        manifest: { version: 1, entries: [] },
      },
    };

    expect(renderRun(run)).toBe(
      "ERROR agent-skills/frontmatter agent-config/skills/demo/SKILL.md: Missing name\n" +
        "INFO farmall/info: Ready\n" +
        "CONFLICT CLAUDE.md (destination is not managed by Farmall)\n" +
        "0 artifacts, 0 outputs, 2 diagnostics\n",
    );
  });
});

describe("renderApplied", () => {
  it("renders every application count", () => {
    const result: ApplyResult = { created: 2, updated: 3, deleted: 4, unchanged: 5 };

    expect(renderApplied(result)).toBe("created 2, updated 3, deleted 4, unchanged 5\n");
  });
});

describe("renderJson", () => {
  it("renders indented JSON with a trailing newline", () => {
    expect(renderJson({ status: "ok", paths: ["CLAUDE.md"] })).toEqual({
      ok: true,
      value: '{\n  "status": "ok",\n  "paths": [\n    "CLAUDE.md"\n  ]\n}\n',
    });
  });

  it("renders byte content with the stable base64 tagged representation", () => {
    expect(renderJson({ content: new Uint8Array([0, 0xff, 65]) })).toEqual({
      ok: true,
      value: '{\n  "content": {\n    "encoding": "base64",\n    "data": "AP9B"\n  }\n}\n',
    });
    expect(renderJson({ content: Buffer.from([0, 0xff, 65]) })).toMatchObject({
      ok: true,
      value: expect.stringContaining('"data": "AP9B"'),
    });
  });

  it("omits undefined optional object fields", () => {
    expect(renderJson({ status: "ok", optional: undefined })).toEqual({
      ok: true,
      value: '{\n  "status": "ok"\n}\n',
    });
    expect(renderJson(undefined)).toMatchObject({ ok: false, error: { code: "config" } });
  });

  it.each([BigInt(1), () => "nope", Symbol("nope")])(
    "returns a typed error for unsupported value %s",
    (value) => {
      expect(renderJson({ value })).toMatchObject({
        ok: false,
        error: { code: "config", message: expect.stringContaining("Unable to serialize JSON") },
      });
    },
  );

  it("returns typed errors for cycles and excessively deep JSON", () => {
    const cyclic: Record<string, unknown> = {};
    Object.defineProperty(cyclic, "self", { enumerable: true, value: cyclic });
    const deep = Array.from({ length: 10_000 }).reduce<unknown>((value) => ({ value }), null);

    expect(renderJson(cyclic)).toMatchObject({ ok: false, error: { code: "config" } });
    expect(renderJson(deep)).toMatchObject({ ok: false, error: { code: "config" } });
  });

  it("contains non-Error serialization failures and impossible empty serialization", () => {
    expect(
      renderJson({
        toJSON: () => {
          throw "breach";
        },
      }),
    ).toMatchObject({
      ok: false,
      error: { message: "Unable to serialize JSON output: unsupported value" },
    });
    const stringify = vi.spyOn(JSON, "stringify").mockReturnValueOnce(undefined);
    expect(renderJson(null)).toEqual({
      ok: false,
      error: { code: "config", message: "Unable to serialize JSON output" },
    });
    stringify.mockRestore();
  });
});
