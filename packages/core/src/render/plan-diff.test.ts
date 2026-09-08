import { describe, expect, it } from "vitest";

import { desiredFile } from "../test-filesystem.ts";
import type { Plan } from "../types.ts";
import { renderDiff } from "./plan-diff.ts";

describe("renderDiff", () => {
  it("renders every visible action variant and omits noops", () => {
    const desired = desiredFile("conflict.md", "generated");
    const plan: Plan = {
      root: "/project",
      statePath: ".state.json",
      manifest: { version: 1, entries: [] },
      actions: [
        {
          action: "create",
          path: "create.md",
          output: "x",
          after: "new",
          desired: desiredFile("create.md", "new"),
        },
        {
          action: "update",
          path: "update.md",
          output: "x",
          before: "old",
          after: "new",
          desired: desiredFile("update.md", "new"),
        },
        { action: "delete", path: "delete.md", output: "x", before: "old" },
        {
          action: "conflict",
          path: "conflict.md",
          output: "x",
          before: "human",
          after: "generated",
          reason: "edited",
          desired,
        },
        {
          action: "conflict",
          path: "absent.md",
          output: "x",
          after: "generated",
          reason: "claimed",
          desired,
        },
        {
          action: "conflict",
          path: "stale.md",
          output: "x",
          before: "human",
          reason: "edited stale",
        },
        {
          action: "noop",
          path: "same.md",
          output: "x",
          before: "same",
          after: "same",
          desired: desiredFile("same.md", "same"),
        },
      ],
    };

    const output = renderDiff(plan);

    expect(output).toContain("--- /dev/null\n+++ create.md\n+new");
    expect(output).toContain("--- update.md\n+++ update.md\n-old\n+new");
    expect(output).toContain("--- delete.md\n+++ /dev/null\n-old");
    expect(output).toContain("--- conflict.md\n+++ conflict.md\n-human\n+generated\n! edited");
    expect(output).toContain("--- stale.md\n+++ stale.md\n-human\n! edited stale");
    expect(output).not.toContain("same.md");
  });

  it("reports a plan without differences", () => {
    expect(
      renderDiff({
        root: "/project",
        statePath: ".state.json",
        manifest: { version: 1, entries: [] },
        actions: [],
      }),
    ).toBe("No differences\n");
  });

  it("renders binary actions as stable byte-counted digest markers", () => {
    const before = new Uint8Array([0, 0xff]);
    const after = new Uint8Array([0, 0xfe, 1]);
    const desired = desiredFile("tool", after);
    const output = renderDiff({
      root: "/project",
      statePath: ".state.json",
      manifest: { version: 1, entries: [] },
      actions: [
        { action: "create", path: "create", output: "x", after, desired },
        { action: "update", path: "update", output: "x", before, after, desired },
        { action: "delete", path: "delete", output: "x", before },
      ],
    });

    expect(output).toContain(
      "+[binary 3 bytes sha256:2f193e0f656531749c2bb0180a3cfd4ef8d10e9106c83efa52b072342f7968a2]",
    );
    expect(output).toContain(
      "-[binary 2 bytes sha256:06eb7d6a69ee19e5fbdf749018d3d2abfa04bcbd1365db312eb86dc7169389b8]",
    );
    expect(output).not.toContain("�");
  });
});
