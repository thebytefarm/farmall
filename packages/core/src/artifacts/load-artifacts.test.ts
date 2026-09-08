import { describe, expect, it } from "vitest";

import { err, ok } from "../result.ts";
import type { CoreError, PluginContext } from "../types.ts";
import { loadArtifact, loadArtifacts } from "./load-artifacts.ts";

const sourceError = (path: string) => err<CoreError>({ code: "source", message: path, path });

const context = (overrides: Partial<PluginContext> = {}): PluginContext => {
  const read = overrides.read ?? (async () => ok("content"));
  const readBytes = async (path: string) => {
    const result = await read(path);
    if (!result.ok) return result;
    return ok(new TextEncoder().encode(result.value));
  };
  const readFileRecord = async (path: string) => {
    const result = await readBytes(path);
    if (!result.ok) return result;
    return ok({ content: result.value, mode: 0o644 });
  };
  return {
    root: "/project",
    read,
    readBytes,
    readFileRecord,
    glob: async () => ok([]),
    walk: async () => ok([]),
    ...overrides,
  };
};

describe("loadArtifact", () => {
  it("uses safe directory names for skills without frontmatter", async () => {
    await expect(
      loadArtifact(
        context({ walk: async () => ok(["skills/review/SKILL.md"]) }),
        "skills",
        "skills/review/SKILL.md",
        ".",
      ),
    ).resolves.toMatchObject({ ok: true, value: { name: "review" } });
  });

  it("rejects non-string metadata names and unsafe derived or explicit names", async () => {
    const metadata = context({
      read: async () => ok("---\nname: 42\n---\nSkill"),
      walk: async () => ok([]),
    });
    const results = await Promise.all([
      loadArtifact(metadata, "skills", "skills/review/SKILL.md", "."),
      loadArtifact(context(), "rules", "rules/.md", "."),
      loadArtifact(context(), "rules", "rules/review.md", ".", "../review"),
      loadArtifact(context(), "rules", "../review.md", "."),
    ]);
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it("propagates document, walk, bundle path, and bundle read errors", async () => {
    const invalidDocument = context({ read: async () => ok("---\ninvalid: [\n---\n") });
    const walkError = context({ walk: async () => sourceError("walk") });
    const invalidBundlePath = context({ walk: async () => ok(["outside/file.md"]) });
    const bundleReadError = context({
      walk: async () => ok(["skills/review/a.md", "skills/review/b.md", "skills/review/c.md"]),
      read: async (path) => {
        if (path.endsWith("SKILL.md")) return ok("skill");
        return sourceError(path);
      },
      readFileRecord: async (path) => {
        if (path.endsWith("SKILL.md") || path.endsWith("a.md")) {
          return ok({ content: new TextEncoder().encode("a"), mode: 0o644 });
        }
        return sourceError(path);
      },
    });
    const results = await Promise.all([
      loadArtifact(invalidDocument, "rules", "rules/review.md", "."),
      loadArtifact(walkError, "skills", "skills/review/SKILL.md", "."),
      loadArtifact(invalidBundlePath, "skills", "skills/review/SKILL.md", "."),
      loadArtifact(bundleReadError, "skills", "skills/review/SKILL.md", "."),
    ]);
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it("rejects binary primary Markdown", async () => {
    const binary = context({
      readFileRecord: async () => ok({ content: new Uint8Array([0, 0xff]), mode: 0o644 }),
    });
    await expect(loadArtifact(binary, "rules", "rules/binary.md", ".")).resolves.toMatchObject({
      ok: false,
      error: { message: "Artifact Markdown must be UTF-8 text" },
    });
  });
});

describe("loadArtifacts", () => {
  it("propagates glob errors and stops loading after the first artifact error", async () => {
    const globError = await loadArtifacts(
      context({ glob: async () => sourceError("glob") }),
      ".",
      "rules",
      ["rules/**/*.md"],
    );
    const readError = await loadArtifacts(
      context({
        glob: async () => ok(["rules/a.md", "rules/b.md"]),
        read: async (path) => sourceError(path),
      }),
      ".",
      "rules",
      ["rules/**/*.md"],
    );
    expect(globError).toMatchObject({ ok: false, error: { path: "glob" } });
    expect(readError).toMatchObject({ ok: false, error: { path: "rules/a.md" } });
  });
});
