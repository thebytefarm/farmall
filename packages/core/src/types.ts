/** Core domain types shared across the faux engine and the CLI. */

/** What the CLI can push out to agent platforms. */
export const SYNC_TARGETS = ["instructions", "rules", "skills", "subagents", "agents"] as const;
export type Target = (typeof SYNC_TARGETS)[number];

/** Agent platforms we aim to keep in sync. */
export const PLATFORMS = [
  "claude-code",
  "cursor",
  "codex",
  "copilot",
  "opencode",
  "devin",
  "pi",
] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Human labels for the platforms, for pretty output. */
export const PLATFORM_LABELS: Readonly<Record<Platform, string>> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  copilot: "Copilot",
  opencode: "opencode",
  devin: "Devin",
  pi: "pi",
};

/** Lint rule identifiers. */
export const RULE_IDS = ["trigger-compat", "frontmatter-drift", "portability"] as const;
export type RuleId = (typeof RULE_IDS)[number];

/** Rule severities. `off` is reported nowhere; `error` fails the run. */
export type Severity = "error" | "warn" | "off";

/** Default severity per rule — mirrors the rule catalog in the docs. */
export const DEFAULT_SEVERITIES: Readonly<Record<RuleId, Severity>> = {
  "trigger-compat": "error",
  "frontmatter-drift": "warn",
  portability: "error",
};

/** Per-target sync behavior. */
export type SyncSpec = boolean | SyncSpecObject;

export interface SyncSpecObject {
  readonly include?: string;
  readonly exclude?: string;
  readonly format?: string;
  readonly out?: string;
}

export interface LintOverride {
  readonly platform: Platform;
  readonly rules: Partial<Record<RuleId, Severity>>;
}

export interface LintConfig {
  readonly rules?: Partial<Record<RuleId, Severity>>;
  readonly overrides?: readonly LintOverride[];
}

/** The full `farmall.config.ts` shape. */
export interface FarmallConfig {
  readonly source?: string;
  readonly platforms: readonly Platform[];
  readonly sync?: Partial<Record<Target, SyncSpec>>;
  readonly lint?: LintConfig;
}

export const isTarget = (value: string): value is Target =>
  (SYNC_TARGETS as readonly string[]).includes(value);

export const isPlatform = (value: string): value is Platform =>
  (PLATFORMS as readonly string[]).includes(value);
