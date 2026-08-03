import type { Target } from "./types.ts";

/** A single artifact discovered in the source of truth. */
export interface Artifact {
  readonly name: string;
  /** Path relative to the repo root (source-side). */
  readonly path: string;
  /** Short human description, for pretty listings. */
  readonly summary: string;
  /** Frontmatter keys the file declares (drives frontmatter-drift lint). */
  readonly frontmatter: readonly string[];
}

/** The faux contents of `.farmall/` (plus root `AGENTS.md` for instructions). */
export const INVENTORY: Readonly<Record<Target, readonly Artifact[]>> = {
  instructions: [
    { name: "AGENTS.md", path: "AGENTS.md", summary: "Root project memory", frontmatter: [] },
    {
      name: "packages/api/AGENTS.md",
      path: "packages/api/AGENTS.md",
      summary: "API service conventions",
      frontmatter: [],
    },
  ],
  rules: [
    {
      name: "typescript-style",
      path: ".farmall/rules/typescript-style.md",
      summary: "TS naming, imports, no-class",
      frontmatter: ["description", "globs"],
    },
    {
      name: "commit-format",
      path: ".farmall/rules/commit-format.md",
      summary: "Conventional Commits enforcement",
      frontmatter: ["description", "globs", "alwaysApply"],
    },
    {
      name: "no-secrets",
      path: ".farmall/rules/no-secrets.md",
      summary: "Block committing secrets/env files",
      frontmatter: ["description", "globs"],
    },
  ],
  skills: [
    {
      name: "changeset",
      path: ".farmall/skills/changeset/SKILL.md",
      summary: "Author a changeset for the current diff",
      frontmatter: ["name", "description"],
    },
    {
      name: "pr-review",
      path: ".farmall/skills/pr-review/SKILL.md",
      summary: "Review the working diff for bugs and cleanups",
      frontmatter: ["name", "description", "allowed-tools"],
    },
    {
      name: "release-notes",
      path: ".farmall/skills/release-notes/SKILL.md",
      summary: "Draft release notes from merged PRs",
      frontmatter: ["name", "description", "model"],
    },
  ],
  subagents: [
    {
      name: "test-runner",
      path: ".farmall/subagents/test-runner.md",
      summary: "Runs and triages the test suite",
      frontmatter: ["name", "description", "tools"],
    },
    {
      name: "doc-writer",
      path: ".farmall/subagents/doc-writer.md",
      summary: "Writes docs from source comments",
      frontmatter: ["name", "description", "tools", "model"],
    },
  ],
  agents: [
    {
      name: "settings",
      path: ".farmall/agents/settings.json",
      summary: "Shared agent-level settings",
      frontmatter: [],
    },
  ],
};

/** All artifacts for a target. */
export const artifactsFor = (target: Target): readonly Artifact[] => INVENTORY[target];

/** Count of artifacts for a target. */
export const artifactCount = (target: Target): number => INVENTORY[target].length;
