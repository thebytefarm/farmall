import { execFile } from "node:child_process";
import { glob } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const packedPackageSchema = z.object({
  files: z.array(z.object({ path: z.string() })),
});

const parsePackedPackage = (stdout: string): z.infer<typeof packedPackageSchema> => {
  const jsonStart = stdout.lastIndexOf("\n{");
  if (jsonStart < 0) return packedPackageSchema.parse(JSON.parse(stdout));
  return packedPackageSchema.parse(JSON.parse(stdout.slice(jsonStart + 1)));
};

describe("package contents", () => {
  it("packs declarations and every required nested runtime file without stale files", async () => {
    const packageRoot = join(import.meta.dirname, "..");
    const { stdout } = await execFileAsync(
      "pnpm",
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      { cwd: packageRoot },
    );
    const packed = parsePackedPackage(stdout);
    const paths = packed.files.map((file) => file.path);
    const sourcePaths = await Array.fromAsync(glob("src/**/*.ts", { cwd: packageRoot }));
    const emittedPaths = sourcePaths
      .filter((path) => !path.endsWith(".test.ts"))
      .flatMap((path) => {
        const stem = path.slice("src/".length, -".ts".length);
        return [`dist/${stem}.d.ts`, `dist/${stem}.js`];
      });
    const expectedPaths = [...emittedPaths, "LICENSE", "package.json", "README.md"].toSorted();

    expect(paths.toSorted()).toEqual(expectedPaths);
    expect(paths).toContain("dist/index.d.ts");
    expect(paths).toContain("dist/index.js");
    expect(paths).toContain("dist/commands/project-command.d.ts");
    expect(paths).toContain("dist/commands/project-command.js");
  });
});
