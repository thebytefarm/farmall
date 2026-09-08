import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Diagnostic } from "../diagnostics/types.ts";
import type { PipelineRun } from "../pipeline/types.ts";
import { withTestFilesystem, writeTestFile } from "../test-filesystem.ts";
import {
  applyPipelineRun,
  prepareProject,
  syncProject,
  validatePipelineRun,
} from "./project-run.ts";

const config = (includeLint: boolean): string => {
  if (!includeLint) {
    return `export default { pipelines: { default: { sources: [{ use: "farmall:source" }], outputs: [{ use: "farmall:codex" }] } } };`;
  }
  return `export default { pipelines: { default: { sources: [{ use: "farmall:source" }], lint: [{ use: "farmall:lint", options: { platforms: ["codex"] } }], outputs: [{ use: "farmall:codex" }] } } };`;
};

const pipelineRun = (diagnostics: readonly Diagnostic[] = [], root = "/project"): PipelineRun => ({
  pipeline: "default",
  emissions: [],
  desired: [],
  diagnostics,
  plan: {
    root,
    statePath: ".state.json",
    pipeline: "default",
    previousManifest: { version: 1, entries: [] },
    actions: [],
    manifest: { version: 1, entries: [] },
  },
});

describe("project runs", () => {
  it("prepares, applies, and idempotently syncs a real project", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "farmall.config.mjs", config(true)),
        writeTestFile(
          root,
          "agent-config/skills/review/SKILL.md",
          "---\nname: review\ndescription: Reviews code\n---\nReview carefully.\n",
        ),
        writeTestFile(root, "agent-config/skills/review/checklist.md", "checklist"),
      ]);

      const prepared = await prepareProject({ cwd: join(root, "agent-config", "skills") });
      const first = await syncProject({ cwd: root });
      const second = await syncProject({ cwd: root });

      expect(prepared).toMatchObject({
        ok: true,
        value: { plan: { actions: [{ action: "create" }, { action: "create" }] } },
      });
      expect(first).toMatchObject({
        ok: true,
        value: { applied: { created: 2, updated: 0, deleted: 0, unchanged: 0 } },
      });
      expect(second).toMatchObject({
        ok: true,
        value: { applied: { created: 0, updated: 0, deleted: 0, unchanged: 2 } },
      });
      await expect(
        readFile(join(root, ".agents/skills/review/checklist.md"), "utf8"),
      ).resolves.toBe("checklist");
    }));

  it("preserves the generated pull flow", async () =>
    withTestFilesystem(async (root) => {
      const { initProject } = await import("./init-project.ts");
      await initProject(root);
      await writeTestFile(root, "CLAUDE.md", "pulled instructions");

      const pull = await prepareProject({ cwd: root, pipeline: "pull" });

      expect(pull).toMatchObject({
        ok: true,
        value: {
          plan: {
            actions: [
              {
                action: "create",
                path: "agent-config/AGENTS.md",
                desired: { writePolicy: "create-only" },
              },
            ],
          },
        },
      });
    }));

  it("passes explicit config and pipeline selections through preparation", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(
        root,
        "configs/custom.mjs",
        `export default { pipelines: { release: { sources: [{ use: "farmall:source", options: { root: "source" } }], outputs: [{ use: "farmall:codex" }] } } };`,
      );
      await writeTestFile(root, "configs/source/AGENTS.md", "instructions");

      const result = await prepareProject({
        cwd: root,
        configPath: "configs/custom.mjs",
        pipeline: "release",
      });

      expect(result).toMatchObject({
        ok: true,
        value: { pipeline: "release", plan: { actions: [{ path: "AGENTS.md" }] } },
      });
    }));

  it("propagates preparation and synchronization failures", async () =>
    withTestFilesystem(async (root) => {
      const prepared = await prepareProject({ cwd: root });
      const synced = await syncProject({ cwd: root });

      expect(prepared).toMatchObject({ ok: false, error: { code: "config" } });
      expect(synced).toMatchObject({ ok: false, error: { code: "config" } });
    }));

  it("blocks lint failures and unmanaged conflicts without writing", async () =>
    withTestFilesystem(async (root) => {
      await Promise.all([
        writeTestFile(root, "farmall.config.mjs", config(true)),
        writeTestFile(root, "agent-config/skills/broken/SKILL.md", "No frontmatter"),
      ]);
      const lintFailure = await syncProject({ cwd: root });
      await writeTestFile(root, "farmall.config.mjs", config(false));
      await writeTestFile(
        root,
        "agent-config/skills/broken/SKILL.md",
        "---\nname: broken\ndescription: Fixed\n---\n",
      );
      await writeTestFile(root, "agent-config/AGENTS.md", "generated");
      await writeTestFile(root, "AGENTS.md", "human");
      const conflict = await syncProject({ cwd: root });

      expect(lintFailure).toMatchObject({ ok: false, error: { code: "lint" } });
      expect(conflict).toMatchObject({ ok: false, error: { code: "conflict" } });
      await expect(readFile(join(root, "AGENTS.md"), "utf8")).resolves.toBe("human");
    }));
});

describe("validatePipelineRun", () => {
  it.each([
    [{ rule: "rule", severity: "error", message: "blocked", path: "a.md", plugin: "lint" }],
    [{ rule: "rule", severity: "error", message: "blocked", path: "a.md" }],
    [{ rule: "rule", severity: "error", message: "blocked", plugin: "lint" }],
    [{ rule: "rule", severity: "error", message: "blocked" }],
  ] as const)("preserves available lint context", (diagnostic) => {
    expect(validatePipelineRun(pipelineRun([diagnostic]))).toMatchObject({
      ok: false,
      error: { code: "lint", message: "blocked" },
    });
  });

  it("returns conflict reasons and the generic fallback", () => {
    const reasoned = pipelineRun();
    const generic = pipelineRun();
    const reasonedRun = {
      ...reasoned,
      plan: {
        ...reasoned.plan,
        actions: [{ action: "conflict" as const, path: "a.md", output: "test", reason: "edited" }],
      },
    };
    const genericRun = {
      ...generic,
      plan: {
        ...generic.plan,
        actions: [{ action: "conflict" as const, path: "b.md", output: "test" }],
      },
    };

    expect(validatePipelineRun(reasonedRun)).toMatchObject({ error: { message: "edited" } });
    expect(validatePipelineRun(genericRun)).toMatchObject({
      error: { message: "Pipeline has output conflicts" },
    });
  });

  it("applies valid runs and rejects invalid runs", async () =>
    withTestFilesystem(async (root) => {
      const valid = pipelineRun([], root);
      const invalid = pipelineRun([{ rule: "rule", severity: "error", message: "blocked" }], root);

      await expect(applyPipelineRun(valid)).resolves.toMatchObject({ ok: true });
      await expect(applyPipelineRun(invalid)).resolves.toMatchObject({ ok: false });
    }));
});
