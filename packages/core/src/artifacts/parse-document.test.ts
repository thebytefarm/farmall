import { describe, expect, it } from "vitest";

import { parseDocument } from "./parse-document.ts";

describe("parseDocument", () => {
  it("returns plain markdown and non-markdown content unchanged", () => {
    expect(parseDocument("rule.md", "plain")).toEqual({
      ok: true,
      value: { body: "plain", metadata: {} },
    });
    expect(parseDocument("config.json", "---\nnot: frontmatter")).toEqual({
      ok: true,
      value: { body: "---\nnot: frontmatter", metadata: {} },
    });
  });

  it("parses valid frontmatter and returns invalid frontmatter as a source error", () => {
    expect(parseDocument("skill.mdc", "---\nname: review\n---\nBody")).toMatchObject({
      ok: true,
      value: { body: "Body", metadata: { name: "review" } },
    });
    expect(parseDocument("skill.md", "---\ninvalid: [\n---\nBody")).toMatchObject({
      ok: false,
      error: { code: "source", path: "skill.md" },
    });
    expect(parseDocument("skill.md", "---\ninvalid: .nan\n---\nBody")).toEqual({
      ok: false,
      error: {
        code: "source",
        message: "Frontmatter metadata must be JSON",
        path: "skill.md",
      },
    });
  });
});
