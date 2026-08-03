import type { FarmallConfig, Platform, RuleId, Severity, Target } from "./types.ts";
import { DEFAULT_SEVERITIES } from "./types.ts";

/** A single faux lint finding against one artifact/platform. */
export interface Finding {
  readonly rule: RuleId;
  readonly severity: Severity;
  readonly target: Target;
  readonly platform: Platform;
  readonly artifact: string;
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly help: string;
  /** Faux source line shown in the code frame. */
  readonly snippet: string;
}

/** The canned findings the mock reports — believable, cross-platform gaps. */
const CANNED: readonly Finding[] = [
  {
    rule: "trigger-compat",
    severity: "error",
    target: "skills",
    platform: "codex",
    artifact: "pr-review",
    path: ".farmall/skills/pr-review/SKILL.md",
    line: 3,
    column: 14,
    message:
      "description is 512 chars; codex truncates triggers at 400 and the skill may never fire",
    help: "Tighten the description to a single triggering sentence under 400 characters.",
    snippet: "description: Review the working diff for bugs, cleanups, perf, style, and…",
  },
  {
    rule: "frontmatter-drift",
    severity: "warn",
    target: "skills",
    platform: "cursor",
    artifact: "pr-review",
    path: ".farmall/skills/pr-review/SKILL.md",
    line: 4,
    column: 1,
    message: "`allowed-tools` is silently dropped by cursor; the skill runs unrestricted there",
    help: "Either accept the drift or gate the skill to platforms that honor allowed-tools.",
    snippet: "allowed-tools: Bash, Read, Grep",
  },
  {
    rule: "frontmatter-drift",
    severity: "warn",
    target: "subagents",
    platform: "opencode",
    artifact: "doc-writer",
    path: ".farmall/subagents/doc-writer.md",
    line: 5,
    column: 1,
    message: "`model` key is ignored by opencode; it uses the session model instead",
    help: "Drop `model` for opencode or set it via the agent config target.",
    snippet: "model: claude-opus-4-8",
  },
  {
    rule: "portability",
    severity: "error",
    target: "subagents",
    platform: "cursor",
    artifact: "test-runner",
    path: ".farmall/subagents/test-runner.md",
    line: 1,
    column: 1,
    message: "cursor has no subagent system; this artifact cannot be projected there at all",
    help: "Exclude cursor from subagents sync, or drop the subagent.",
    snippet: "name: test-runner",
  },
  {
    rule: "portability",
    severity: "error",
    target: "rules",
    platform: "codex",
    artifact: "commit-format",
    path: ".farmall/rules/commit-format.md",
    line: 1,
    column: 1,
    message: "codex has no rules loader; scoped rule files have no home here",
    help: "Fold critical rules into AGENTS.md instructions for codex.",
    snippet: "description: Enforce Conventional Commits",
  },
];

/** Resolve the effective severity for a rule on a platform, honoring overrides. */
export const severityFor = (config: FarmallConfig, rule: RuleId, platform: Platform): Severity => {
  const override = config.lint?.overrides?.find((entry) => entry.platform === platform);
  return override?.rules?.[rule] ?? config.lint?.rules?.[rule] ?? DEFAULT_SEVERITIES[rule];
};

export interface LintResult {
  readonly findings: readonly Finding[];
  readonly errors: number;
  readonly warnings: number;
}

/**
 * Faux lint run. Filters the canned findings to the requested target and the
 * config's platforms, then applies effective severities (dropping `off`).
 */
export const runLint = (
  config: FarmallConfig,
  opts?: { readonly target?: Target; readonly platform?: Platform },
): LintResult => {
  const findings = CANNED.filter((finding) => {
    if (opts?.target && finding.target !== opts.target) return false;
    if (opts?.platform && finding.platform !== opts.platform) return false;
    return config.platforms.includes(finding.platform);
  })
    .map((finding) => ({
      ...finding,
      severity: severityFor(config, finding.rule, finding.platform),
    }))
    .filter((finding) => finding.severity !== "off");

  return {
    findings,
    errors: findings.filter((finding) => finding.severity === "error").length,
    warnings: findings.filter((finding) => finding.severity === "warn").length,
  };
};
