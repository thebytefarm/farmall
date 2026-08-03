import type { Platform, Target } from "./types.ts";

/** Sentinel for an unsupported target/platform pair. */
export const UNSUPPORTED = "—" as const;
/** Sentinel for limited / convention-dependent support. */
export const PARTIAL = "partial" as const;

/**
 * Canonical target × platform mapping — where each artifact lands on each
 * agent, and where it can't land at all. Faux ground truth; mirrors
 * `docs/reference/support-matrix.md`.
 */
export const SUPPORT_MATRIX: Readonly<Record<Target, Readonly<Record<Platform, string>>>> = {
  instructions: {
    "claude-code": "CLAUDE.md",
    cursor: "AGENTS.md",
    codex: "AGENTS.md",
    copilot: ".github/copilot-instructions.md",
    opencode: "AGENTS.md",
    devin: "AGENTS.md",
    pi: "AGENTS.md",
  },
  rules: {
    "claude-code": ".claude/rules/*.md",
    cursor: ".cursor/rules/*.mdc",
    codex: UNSUPPORTED,
    copilot: ".github/instructions/*.instructions.md",
    opencode: PARTIAL,
    devin: ".devin/rules/*.md",
    pi: UNSUPPORTED,
  },
  skills: {
    "claude-code": ".claude/skills/<name>/",
    cursor: ".cursor/skills/<name>/",
    codex: ".agents/skills/<name>/",
    copilot: ".github/skills/<name>/",
    opencode: PARTIAL,
    devin: ".agents/skills/<name>/",
    pi: ".agents/skills/<name>/",
  },
  subagents: {
    "claude-code": ".claude/agents/<name>.md",
    cursor: UNSUPPORTED,
    codex: PARTIAL,
    copilot: UNSUPPORTED,
    opencode: ".opencode/agent/<name>.md",
    devin: PARTIAL,
    pi: UNSUPPORTED,
  },
  agents: {
    "claude-code": ".claude/settings.json",
    cursor: ".cursor/",
    codex: ".codex/config.toml",
    copilot: UNSUPPORTED,
    opencode: "opencode.json",
    devin: ".devin/config.json",
    pi: ".pi/settings.json",
  },
};

export type Support = "full" | "partial" | "none";

/** Where a target lands on a platform (raw matrix cell). */
export const locationFor = (target: Target, platform: Platform): string =>
  SUPPORT_MATRIX[target][platform];

/** Classify a target/platform cell into a support level. */
export const supportFor = (target: Target, platform: Platform): Support => {
  const cell = locationFor(target, platform);
  if (cell === UNSUPPORTED) return "none";
  if (cell === PARTIAL) return "partial";
  return "full";
};

export const isSupported = (target: Target, platform: Platform): boolean =>
  supportFor(target, platform) !== "none";
