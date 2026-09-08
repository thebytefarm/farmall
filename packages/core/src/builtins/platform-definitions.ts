import type { ArtifactKind } from "../types.ts";
import { deepFreeze } from "massaman/object";

export type OutputPaths = Readonly<Record<ArtifactKind, string | false>>;

export interface PlatformDefinition {
  readonly id: string;
  readonly paths: OutputPaths;
  readonly allowedSkillFields: readonly string[];
}

const STANDARD_SKILL_FIELDS = [
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
] as const;

const CLAUDE_CODE_SKILL_FIELDS = [
  ...STANDARD_SKILL_FIELDS,
  "when_to_use",
  "argument-hint",
  "arguments",
  "disable-model-invocation",
  "user-invocable",
  "disallowed-tools",
  "model",
  "effort",
  "context",
  "agent",
  "background",
  "hooks",
  "paths",
  "shell",
] as const;

const CURSOR_SKILL_FIELDS = [
  "name",
  "description",
  "paths",
  "disable-model-invocation",
  "icon",
  "color",
  "metadata",
  "globs",
] as const;

const COPILOT_SKILL_FIELDS = [
  ...STANDARD_SKILL_FIELDS,
  "argument-hint",
  "user-invocable",
  "disable-model-invocation",
] as const;

const OPENCODE_SKILL_FIELDS = [
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
] as const;

const DEVIN_SKILL_FIELDS = [
  "name",
  "description",
  "allowed-tools",
  "argument-hint",
  "model",
  "subagent",
  "agent",
  "permissions",
  "triggers",
] as const;

const PI_SKILL_FIELDS = [...STANDARD_SKILL_FIELDS, "disable-model-invocation"] as const;

export const PLATFORM_DEFINITION_BY_ID = deepFreeze({
  "claude-code": {
    id: "claude-code",
    paths: {
      instructions: "CLAUDE.md",
      rules: ".claude/rules/{name}.md",
      skills: ".claude/skills/{name}/{file}",
      subagents: ".claude/agents/{name}.md",
    },
    allowedSkillFields: CLAUDE_CODE_SKILL_FIELDS,
  },
  cursor: {
    id: "cursor",
    paths: {
      instructions: "AGENTS.md",
      rules: ".cursor/rules/{name}.mdc",
      skills: ".cursor/skills/{name}/{file}",
      subagents: ".cursor/agents/{name}.md",
    },
    allowedSkillFields: CURSOR_SKILL_FIELDS,
  },
  codex: {
    id: "codex",
    paths: {
      instructions: "AGENTS.md",
      rules: false,
      skills: ".agents/skills/{name}/{file}",
      subagents: false,
    },
    allowedSkillFields: STANDARD_SKILL_FIELDS,
  },
  copilot: {
    id: "copilot",
    paths: {
      instructions: ".github/copilot-instructions.md",
      rules: ".github/instructions/{name}.instructions.md",
      skills: ".github/skills/{name}/{file}",
      subagents: ".github/agents/{name}.agent.md",
    },
    allowedSkillFields: COPILOT_SKILL_FIELDS,
  },
  opencode: {
    id: "opencode",
    paths: {
      instructions: "AGENTS.md",
      rules: false,
      skills: ".opencode/skills/{name}/{file}",
      subagents: ".opencode/agents/{name}.md",
    },
    allowedSkillFields: OPENCODE_SKILL_FIELDS,
  },
  windsurf: {
    id: "windsurf",
    paths: {
      instructions: ".windsurf/rules/farmall.md",
      rules: ".windsurf/rules/{name}.md",
      skills: ".windsurf/skills/{name}/{file}",
      subagents: false,
    },
    allowedSkillFields: STANDARD_SKILL_FIELDS,
  },
  devin: {
    id: "devin",
    paths: {
      instructions: "AGENTS.md",
      rules: ".devin/rules/{name}.md",
      skills: ".agents/skills/{name}/{file}",
      subagents: false,
    },
    allowedSkillFields: DEVIN_SKILL_FIELDS,
  },
  pi: {
    id: "pi",
    paths: {
      instructions: "AGENTS.md",
      rules: false,
      skills: ".agents/skills/{name}/{file}",
      subagents: false,
    },
    allowedSkillFields: PI_SKILL_FIELDS,
  },
} as const satisfies Readonly<Record<string, PlatformDefinition>>);

export type PlatformId = keyof typeof PLATFORM_DEFINITION_BY_ID;

export const PLATFORM_IDS = Object.keys(PLATFORM_DEFINITION_BY_ID) as readonly PlatformId[];

export const PLATFORM_DEFINITIONS = PLATFORM_IDS.map((id) => PLATFORM_DEFINITION_BY_ID[id]);

export const FILESYSTEM_DEFINITION: PlatformDefinition = {
  id: "filesystem",
  paths: {
    instructions: "AGENTS.md",
    rules: "rules/{name}.md",
    skills: "skills/{name}/{file}",
    subagents: "subagents/{name}.md",
  },
  allowedSkillFields: STANDARD_SKILL_FIELDS,
};

export const platformDefinition = (id: PlatformId): PlatformDefinition =>
  PLATFORM_DEFINITION_BY_ID[id];

export const platformIds = (): readonly string[] => PLATFORM_IDS;
