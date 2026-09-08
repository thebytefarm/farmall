import type { DesiredFile } from "../planning/types.ts";

const DEFAULT_CONFIG = `export default {
  state: ".farmall-state.json",
  pipelines: {
    default: {
      sources: [{ use: "farmall:source", options: { root: "agent-config" } }],
      lint: [{ use: "farmall:lint" }],
      outputs: [
        { use: "farmall:claude-code" },
        { use: "farmall:cursor" },
        { use: "farmall:codex" },
        { use: "farmall:copilot" },
        { use: "farmall:opencode" },
        { use: "farmall:windsurf" },
        { use: "farmall:devin" },
        { use: "farmall:pi" },
      ],
    },
    pull: {
      sources: [{ use: "farmall:platform-source", options: { platform: "claude-code" } }],
      outputs: [{ use: "farmall:filesystem", options: { writePolicy: "create-only" } }],
    },
  },
};
`;

const SOURCE_README = `# Agent configuration

This directory is the default source used by the generated Farmall config. Move it anywhere and update the source plugin's \`root\` option.

- \`AGENTS.md\` stores portable project instructions.
- \`rules/\` stores scoped rules.
- \`skills/<name>/SKILL.md\` stores skills and bundled files.
- \`subagents/\` stores subagent definitions.
- \`outputs/<platform>/...\` stores platform-native files copied directly to that output.
`;

export const initFiles = (): readonly DesiredFile[] => [
  {
    path: "farmall.config.mjs",
    content: DEFAULT_CONFIG,
    output: "init",
    plugin: "farmall:init",
    sources: ["farmall:init"],
    writePolicy: "create-only",
  },
  {
    path: "agent-config/README.md",
    content: SOURCE_README,
    output: "init",
    plugin: "farmall:init",
    sources: ["farmall:init"],
    writePolicy: "create-only",
  },
];
