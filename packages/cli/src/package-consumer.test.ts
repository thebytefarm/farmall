import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

interface Consumer {
  readonly root: string;
  readonly cliPath: string;
}

const workspaceRoot = resolve(import.meta.dirname, "../../..");
const tsgoPath = join(workspaceRoot, "node_modules/.bin/tsgo");

const createConsumer = async (): Promise<Consumer> => {
  const root = await mkdtemp(join(tmpdir(), "farmall-package-consumer-"));
  const tarballs = join(root, "tarballs");
  await mkdir(tarballs);
  spawnPackage("@farmall/core", tarballs);
  spawnPackage("farmall", tarballs);

  const coreTarball = join(tarballs, "farmall-core-0.0.2.tgz");
  const cliTarball = join(tarballs, "farmall-0.0.2.tgz");
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "farmall-package-consumer",
        private: true,
        type: "module",
        dependencies: {
          "@farmall/core": `file:${coreTarball}`,
          farmall: `file:${cliTarball}`,
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(root, "pnpm-workspace.yaml"),
    `overrides:\n  '@farmall/core': file:${coreTarball}\n`,
  );
  expectCommand(
    spawnSync("pnpm", ["install", "--prefer-offline"], {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000,
    }),
  );

  return { root, cliPath: join(root, "node_modules/.bin/farmall") };
};

const spawnPackage = (name: string, destination: string): void => {
  expectCommand(
    spawnSync("pnpm", ["--filter", name, "pack", "--pack-destination", destination], {
      cwd: workspaceRoot,
      encoding: "utf8",
      timeout: 10_000,
    }),
  );
};

const expectCommand = (result: ReturnType<typeof spawnSync>): void => {
  if (result.error) throw result.error;
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
};

const withConsumer = async (run: (consumer: Consumer) => Promise<void>): Promise<void> => {
  const consumer = await createConsumer();
  try {
    await run(consumer);
  } finally {
    await rm(consumer.root, { recursive: true, force: true });
  }
};

describe("packed package consumer", () => {
  it(
    "installs both tarballs and exposes the root core runtime and types",
    () =>
      withConsumer(async (consumer) => {
        const cliManifest = JSON.parse(
          await readFile(join(consumer.root, "node_modules/farmall/package.json"), "utf8"),
        ) as {
          readonly version: string;
          readonly dependencies: Readonly<Record<string, string>>;
        };
        const coreManifest = JSON.parse(
          await readFile(join(consumer.root, "node_modules/@farmall/core/package.json"), "utf8"),
        ) as { readonly version: string };
        expect(cliManifest.version).toBe("0.0.2");
        expect(cliManifest.dependencies["@farmall/core"]).toBe("0.0.2");
        expect(coreManifest.version).toBe("0.0.2");

        await writeFile(
          join(consumer.root, "runtime.mjs"),
          [
            'import { FARMALL_VERSION, defineConfig } from "@farmall/core";',
            'if (FARMALL_VERSION !== "0.0.2") throw new Error(`unexpected version: ${FARMALL_VERSION}`);',
            'if (typeof defineConfig !== "function") throw new Error("missing defineConfig");',
          ].join("\n"),
        );
        await writeFile(
          join(consumer.root, "types.ts"),
          [
            'import { FARMALL_VERSION, type FarmallConfig } from "@farmall/core";',
            "declare const config: FarmallConfig;",
            "const version: string = FARMALL_VERSION;",
            "void config;",
            "void version;",
          ].join("\n"),
        );
        expectCommand(
          spawnSync(process.execPath, [join(consumer.root, "runtime.mjs")], {
            cwd: consumer.root,
            encoding: "utf8",
            timeout: 10_000,
          }),
        );
        expectCommand(
          spawnSync(
            tsgoPath,
            [
              "--ignoreConfig",
              "--noEmit",
              "--module",
              "nodenext",
              "--moduleResolution",
              "nodenext",
              "--target",
              "es2023",
              join(consumer.root, "types.ts"),
            ],
            { cwd: consumer.root, encoding: "utf8", timeout: 10_000 },
          ),
        );
      }),
    30_000,
  );

  it(
    "runs version and help with every Maltty runtime dependency installed",
    () =>
      withConsumer(async (consumer) => {
        const version = spawnSync(consumer.cliPath, ["--version"], {
          cwd: consumer.root,
          encoding: "utf8",
          timeout: 10_000,
        });
        const help = spawnSync(consumer.cliPath, ["--help"], {
          cwd: consumer.root,
          encoding: "utf8",
          timeout: 10_000,
        });

        expect(version).toMatchObject({ status: 0, stdout: "0.0.2\n", stderr: "" });
        expect(help.status).toBe(0);
        expect(help.stdout).toContain("farmall");
      }),
    30_000,
  );
});
