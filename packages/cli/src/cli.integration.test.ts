import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isMatching, P } from "massaman/match";
import { describe, expect, it } from "vitest";

const cliPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));

interface CliResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

const runCli = (cwd: string, ...args: readonly string[]): CliResult => {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const withRepository = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "farmall-cli-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const write = async (root: string, path: string, content: string): Promise<void> => {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
};

const config = {
  state: ".farmall-state.json",
  pipelines: {
    default: {
      sources: [{ use: "farmall:source", options: { root: "agent-config" } }],
      lint: [{ use: "farmall:lint" }],
      outputs: [{ use: "farmall:claude-code" }],
    },
    pull: {
      sources: [{ use: "farmall:source", options: { root: "import-source" } }],
      outputs: [{ use: "farmall:cursor", options: { root: "pulled" } }],
    },
  },
} as const;

const appliedPattern = {
  created: P.number,
  updated: P.number,
  deleted: P.number,
  unchanged: P.number,
};

const planPattern = {
  actions: P.array({ action: P.string, path: P.string }),
};

const pipelineRunPattern = {
  pipeline: P.string,
  plan: planPattern,
};

const appliedPipelinePattern = {
  run: pipelineRunPattern,
  applied: appliedPattern,
};

const byteJsonPattern = {
  encoding: "base64",
  data: P.string,
};

const parseJson = (stdout: string): unknown => JSON.parse(stdout);

const createConfiguredRepository = async (root: string): Promise<void> => {
  await Promise.all([
    write(root, "farmall.config.json", `${JSON.stringify(config, null, 2)}\n`),
    write(root, "agent-config/AGENTS.md", "# Shared instructions\n"),
    write(root, "import-source/AGENTS.md", "# Imported instructions\n"),
  ]);
};

describe("farmall init", () => {
  it("creates the editable config and source layout", () =>
    withRepository(async (root) => {
      const result = runCli(root, "init");

      expect(result).toMatchObject({ status: 0, stderr: "" });
      expect(result.stdout).toBe(
        "Initialized Farmall: created 2, updated 0, deleted 0, unchanged 0\n",
      );
      await expect(readFile(join(root, "farmall.config.mjs"), "utf8")).resolves.toContain(
        'root: "agent-config"',
      );
      await expect(readFile(join(root, "agent-config/README.md"), "utf8")).resolves.toContain(
        "# Agent configuration",
      );
    }));

  it("prints structured JSON", () =>
    withRepository(async (root) => {
      const result = runCli(root, "init", "--json");
      const output = parseJson(result.stdout);

      expect(result).toMatchObject({ status: 0, stderr: "" });
      if (!isMatching({ applied: appliedPattern, plan: planPattern }, output)) {
        throw new Error("init returned unexpected JSON");
      }
      expect(output.applied.created).toBe(2);
      expect(output.plan.actions.map(({ action }) => action)).toEqual(["create", "create"]);
    }));

  it("exits with the conflict code without replacing an existing file", () =>
    withRepository(async (root) => {
      await write(root, "farmall.config.mjs", "export default {};\n");

      const result = runCli(root, "init");

      expect(result.status).toBe(4);
      expect(`${result.stdout}${result.stderr}`).toContain("create-only output already exists");
      await expect(readFile(join(root, "farmall.config.mjs"), "utf8")).resolves.toBe(
        "export default {};\n",
      );
    }));
});

describe("farmall check", () => {
  it("reports drift with exit code 1 without writing outputs", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);

      const result = runCli(root, "check");

      expect(result).toMatchObject({ status: 1, stderr: "" });
      expect(result.stdout).toContain("CREATE   CLAUDE.md");
      await expect(readFile(join(root, "CLAUDE.md"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    }));

  it("prints a structured pipeline run", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);

      const result = runCli(root, "check", "--json");
      const output = parseJson(result.stdout);

      expect(result.status).toBe(1);
      if (!isMatching(pipelineRunPattern, output)) {
        throw new Error("check returned unexpected JSON");
      }
      expect(output.pipeline).toBe("default");
      expect(output.plan.actions.map(({ action }) => action)).toEqual(["create"]);
    }));

  it("exits successfully when generated outputs are current", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);
      expect(runCli(root, "sync").status).toBe(0);

      const result = runCli(root, "check");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("NOOP     CLAUDE.md");
    }));
});

describe("farmall diff", () => {
  it("renders deterministic file differences without writing", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);

      const result = runCli(root, "diff");

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("--- /dev/null\n+++ CLAUDE.md\n+# Shared instructions\n+\n");
      await expect(readFile(join(root, "CLAUDE.md"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    }));

  it("prints structured plan JSON", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);

      const result = runCli(root, "diff", "--json");
      const output = parseJson(result.stdout);

      expect(result.status).toBe(1);
      if (!isMatching(planPattern, output)) {
        throw new Error("diff returned unexpected JSON");
      }
      expect(output.actions).toMatchObject([{ action: "create", path: "CLAUDE.md" }]);
    }));

  it("prints binary plan content as tagged base64 JSON", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);
      const source = join(root, "agent-config/outputs/claude-code/bin/tool");
      await mkdir(dirname(source), { recursive: true });
      await writeFile(source, new Uint8Array([0, 0xff, 65]));

      const result = runCli(root, "diff", "--json");
      const output = parseJson(result.stdout);

      if (!isMatching({ actions: P.array({ path: P.string, after: P.unknown }) }, output)) {
        throw new Error("diff returned unexpected binary JSON");
      }
      const binaryAction = output.actions.find((action) => action.path === "bin/tool");
      if (binaryAction === undefined || !isMatching(byteJsonPattern, binaryAction.after)) {
        throw new Error("diff omitted tagged binary content");
      }
      expect(binaryAction.after).toEqual({
        encoding: "base64",
        data: "AP9B",
      });
    }));

  it("reports no differences after synchronization", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);
      expect(runCli(root, "sync").status).toBe(0);

      const result = runCli(root, "diff");

      expect(result).toMatchObject({ status: 0, stdout: "No differences\n", stderr: "" });
    }));
});

describe("farmall lint", () => {
  it("exits successfully when configured artifacts pass lint", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);

      const result = runCli(root, "lint");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("0 diagnostics");
    }));

  it("prints diagnostics and exits with code 1 for invalid skills", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);
      await write(root, "agent-config/skills/broken/SKILL.md", "# Missing frontmatter\n");

      const result = runCli(root, "lint");

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "ERROR agent-skills/frontmatter agent-config/skills/broken/SKILL.md",
      );
      expect(`${result.stdout}${result.stderr}`).toContain("Lint failed");
    }));
});

describe("farmall sync", () => {
  it("copies binary native outputs and executable mode losslessly", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);
      const source = join(root, "agent-config/outputs/claude-code/bin/tool");
      await mkdir(dirname(source), { recursive: true });
      await writeFile(source, new Uint8Array([0, 0xff, 65]));
      await chmod(source, 0o755);
      await write(
        root,
        "agent-config/skills/tool/SKILL.md",
        "---\nname: tool\ndescription: Binary tool\n---\nRun it.\n",
      );
      const skillSource = join(root, "agent-config/skills/tool/bin/helper");
      await mkdir(dirname(skillSource), { recursive: true });
      await writeFile(skillSource, new Uint8Array([0xff, 0, 66]));
      await chmod(skillSource, 0o751);

      expect(runCli(root, "sync").status).toBe(0);
      expect(new Uint8Array(await readFile(join(root, "bin/tool")))).toEqual(
        new Uint8Array([0, 0xff, 65]),
      );
      expect((await stat(join(root, "bin/tool"))).mode & 0o7777).toBe(0o755);
      expect(new Uint8Array(await readFile(join(root, ".claude/skills/tool/bin/helper")))).toEqual(
        new Uint8Array([0xff, 0, 66]),
      );
      expect((await stat(join(root, ".claude/skills/tool/bin/helper"))).mode & 0o7777).toBe(0o751);
    }));
  it("applies generated outputs and records managed state", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);

      const result = runCli(root, "sync");

      expect(result).toMatchObject({ status: 0, stderr: "" });
      expect(result.stdout).toContain("created 1, updated 0, deleted 0, unchanged 0");
      await expect(readFile(join(root, "CLAUDE.md"), "utf8")).resolves.toBe(
        "# Shared instructions\n",
      );
      await expect(readFile(join(root, ".farmall-state.json"), "utf8")).resolves.toContain(
        '"path": "CLAUDE.md"',
      );
    }));

  it("prints one run-and-apply JSON document with tagged binary content", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);
      const source = join(root, "agent-config/outputs/claude-code/bin/tool");
      await mkdir(dirname(source), { recursive: true });
      await writeFile(source, new Uint8Array([0, 0xff, 65]));

      const result = runCli(root, "sync", "--json");
      const output = parseJson(result.stdout);

      expect(result.status).toBe(0);
      if (!isMatching(appliedPipelinePattern, output)) {
        throw new Error("sync returned unexpected JSON");
      }
      expect(output.run.plan.actions.map(({ action }) => action)).toEqual(["create", "create"]);
      expect(output.applied).toMatchObject({ created: 2, updated: 0, deleted: 0, unchanged: 0 });
      const binaryAction = output.run.plan.actions.find((action) => action.path === "bin/tool");
      if (binaryAction === undefined || !isMatching({ after: byteJsonPattern }, binaryAction)) {
        throw new Error("sync omitted tagged binary content");
      }
      expect(binaryAction.after.data).toBe("AP9B");
      await expect(readFile(join(root, "CLAUDE.md"), "utf8")).resolves.toBe(
        "# Shared instructions\n",
      );
    }));

  it("updates a managed output when its source changes", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);
      expect(runCli(root, "sync").status).toBe(0);
      await write(root, "agent-config/AGENTS.md", "# Updated instructions\n");

      const result = runCli(root, "sync");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("created 0, updated 1, deleted 0, unchanged 0");
      await expect(readFile(join(root, "CLAUDE.md"), "utf8")).resolves.toBe(
        "# Updated instructions\n",
      );
    }));

  it("deletes a stale managed output when its source is removed", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);
      expect(runCli(root, "sync").status).toBe(0);
      await rm(join(root, "agent-config/AGENTS.md"));

      const result = runCli(root, "sync");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("created 0, updated 0, deleted 1, unchanged 0");
      await expect(readFile(join(root, "CLAUDE.md"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    }));

  it("rejects unmanaged destination conflicts without overwriting them", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);
      await write(root, "CLAUDE.md", "# Hand edited\n");

      const result = runCli(root, "sync");

      expect(result.status).toBe(4);
      expect(result.stdout).toContain("CONFLICT CLAUDE.md");
      expect(`${result.stdout}${result.stderr}`).toContain("destination is not managed by Farmall");
      await expect(readFile(join(root, "CLAUDE.md"), "utf8")).resolves.toBe("# Hand edited\n");
    }));

  it("does not print successful JSON when apply validation fails", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);
      await write(root, "CLAUDE.md", "# Hand edited\n");

      const result = runCli(root, "sync", "--json");

      expect(result.status).toBe(4);
      expect(result.stdout.startsWith("{")).toBe(false);
      expect(`${result.stdout}${result.stderr}`).toContain("destination is not managed by Farmall");
    }));
});

describe("farmall pull", () => {
  it("imports Claude Code artifacts with the config generated by init", () =>
    withRepository(async (root) => {
      expect(runCli(root, "init").status).toBe(0);
      await write(root, "CLAUDE.md", "# Imported from Claude\n");

      const result = runCli(root, "pull");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("CREATE   agent-config/AGENTS.md");
      await expect(readFile(join(root, "agent-config/AGENTS.md"), "utf8")).resolves.toBe(
        "# Imported from Claude\n",
      );
    }));

  it("uses the pull pipeline by default and applies imported output", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);

      const result = runCli(root, "pull");

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("CREATE   pulled/AGENTS.md");
      await expect(readFile(join(root, "pulled/AGENTS.md"), "utf8")).resolves.toBe(
        "# Imported instructions\n",
      );
    }));

  it("prints one run-and-apply JSON document", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);

      const result = runCli(root, "pull", "--json");
      const output = parseJson(result.stdout);

      expect(result).toMatchObject({ status: 0, stderr: "" });
      if (!isMatching(appliedPipelinePattern, output)) {
        throw new Error("pull returned unexpected JSON");
      }
      expect(output.run.pipeline).toBe("pull");
      expect(output.run.plan.actions).toMatchObject([
        { action: "create", path: "pulled/AGENTS.md" },
      ]);
      expect(output.applied.created).toBe(1);
    }));
});

describe("farmall errors", () => {
  it("exits with code 3 when no config can be found", () =>
    withRepository(async (root) => {
      const result = runCli(root, "check");

      expect(result.status).toBe(3);
      expect(`${result.stdout}${result.stderr}`).toContain("No Farmall config found");
    }));

  it("exits with code 3 for an unknown pipeline", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);

      const result = runCli(root, "check", "--pipeline", "missing");

      expect(result.status).toBe(3);
      expect(`${result.stdout}${result.stderr}`).toContain("Unknown pipeline: missing");
    }));

  it("exits with code 3 for invalid configuration", () =>
    withRepository(async (root) => {
      await write(root, "farmall.config.json", '{ "pipelines": [] }\n');

      const result = runCli(root, "lint");

      expect(result.status).toBe(3);
      expect(`${result.stdout}${result.stderr}`).toContain("Invalid input");
    }));

  it("exits with code 3 when a configured plugin cannot be resolved", () =>
    withRepository(async (root) => {
      const missingPluginConfig = {
        ...config,
        pipelines: {
          ...config.pipelines,
          default: {
            ...config.pipelines.default,
            sources: [{ use: "missing:source" }],
          },
        },
      };
      await write(root, "farmall.config.json", `${JSON.stringify(missingPluginConfig, null, 2)}\n`);

      const result = runCli(root, "check");

      expect(result.status).toBe(3);
      expect(`${result.stdout}${result.stderr}`).toContain("Unknown plugin: missing:source");
    }));

  it("exits with code 3 when a source document cannot be parsed", () =>
    withRepository(async (root) => {
      await createConfiguredRepository(root);
      await write(root, "agent-config/skills/broken/SKILL.md", "---\nname: [\n---\nBroken\n");

      const result = runCli(root, "check");

      expect(result.status).toBe(3);
      expect(`${result.stdout}${result.stderr}`).toContain("agent-config/skills/broken/SKILL.md");
    }));

  it("exits with code 4 when the state path escapes the repository", () =>
    withRepository(async (root) => {
      await write(
        root,
        "farmall.config.json",
        `${JSON.stringify({ ...config, state: "../outside.json" }, null, 2)}\n`,
      );

      const result = runCli(root, "check");

      expect(result.status).toBe(4);
      expect(`${result.stdout}${result.stderr}`).toContain("Output path escapes project root");
    }));
});
