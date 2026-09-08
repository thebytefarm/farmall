import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { withTestFilesystem, writeTestFile } from "../test-filesystem.ts";
import { initProject } from "./init-project.ts";

describe("initProject", () => {
  it("creates a usable starter project and is idempotent", async () =>
    withTestFilesystem(async (temporary) => {
      const root = join(temporary, "new-project");

      const first = await initProject(root);
      const second = await initProject(root);

      expect(first).toMatchObject({
        ok: true,
        value: { applied: { created: 2, updated: 0, deleted: 0, unchanged: 0 } },
      });
      expect(second).toMatchObject({
        ok: true,
        value: { applied: { created: 0, updated: 0, deleted: 0, unchanged: 2 } },
      });
      await expect(readFile(join(root, "farmall.config.mjs"), "utf8")).resolves.toContain(
        'use: "farmall:platform-source", options: { platform: "claude-code" }',
      );
      await expect(readFile(join(root, "farmall.config.mjs"), "utf8")).resolves.toContain(
        'use: "farmall:filesystem", options: { writePolicy: "create-only" }',
      );
      await expect(readFile(join(root, "agent-config/README.md"), "utf8")).resolves.toContain(
        "`outputs/<platform>/...`",
      );
    }));

  it("does not overwrite an existing config", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "farmall.config.mjs", "human config");

      const result = await initProject(root);

      expect(result).toMatchObject({ ok: false, error: { code: "apply" } });
      await expect(readFile(join(root, "farmall.config.mjs"), "utf8")).resolves.toBe(
        "human config",
      );
    }));

  it("reports root creation and planning failures", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "blocked", "file");
      const creation = await initProject(join(root, "blocked", "project"));
      await mkdir(join(root, ".farmall-state.json"));
      const planning = await initProject(root);

      expect(creation).toMatchObject({ ok: false, error: { code: "apply" } });
      expect(planning).toMatchObject({ ok: false, error: { code: "plan" } });
    }));
});
