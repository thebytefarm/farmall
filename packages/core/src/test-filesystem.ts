import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { DesiredFile, FileContent, Manifest } from "./types.ts";

export const withTestFilesystem = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "farmall-core-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

export const writeTestFile = async (root: string, path: string, content: string): Promise<void> => {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
};

export const writeTestBytes = async (
  root: string,
  path: string,
  content: Uint8Array,
  mode?: number,
): Promise<void> => {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
  if (mode !== undefined) await chmod(destination, mode);
};

export const readTestFile = (root: string, path: string): Promise<string> =>
  readFile(join(root, path), "utf8");

export const readTestBytes = (root: string, path: string): Promise<Uint8Array> =>
  readFile(join(root, path)).then((content) => new Uint8Array(content));

export const desiredFile = (
  path: string,
  content: FileContent,
  overrides: Partial<DesiredFile> = {},
): DesiredFile => ({
  path,
  content,
  output: "codex",
  plugin: "farmall:codex",
  sources: ["rules:source"],
  writePolicy: "managed",
  ...overrides,
});

export const manifestText = (entries: Manifest["entries"]): string =>
  `${JSON.stringify({ version: 1, entries }, null, 2)}\n`;
