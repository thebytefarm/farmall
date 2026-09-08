import { basename, dirname } from "node:path";

import { z } from "zod";

import { err, ok, type Result } from "../result.ts";
import type { Artifact, CoreError, Diagnostic, LintPlugin } from "../types.ts";
import {
  PLATFORM_DEFINITIONS,
  PLATFORM_IDS,
  type PlatformDefinition,
} from "./platform-definitions.ts";

const lintOptionsSchema = z
  .object({
    platforms: z.array(z.enum(PLATFORM_IDS)).min(1).optional(),
  })
  .strict();

type LintOptions = z.infer<typeof lintOptionsSchema>;

const parseOptions = (
  options: Readonly<Record<string, unknown>>,
): Result<LintOptions, CoreError> => {
  const parsed = lintOptionsSchema.safeParse(options);
  if (!parsed.success) {
    return err({
      code: "plugin",
      message: `Invalid farmall:lint options: ${z.prettifyError(parsed.error)}`,
      plugin: "farmall:lint",
    });
  }
  return ok(parsed.data);
};

const selectedPlatforms = (options: LintOptions): readonly PlatformDefinition[] => {
  if (options.platforms === undefined) return PLATFORM_DEFINITIONS;
  return PLATFORM_DEFINITIONS.filter((platform) => options.platforms?.includes(platform.id));
};

const invalidMetadata = (
  skill: Artifact,
  message: string,
  rule = "agent-skills/frontmatter",
): readonly Diagnostic[] => [
  {
    rule,
    severity: "error",
    message: `Skill ${skill.name} ${message}`,
    path: skill.source,
    artifactId: skill.id,
  },
];

const nameDiagnostics = (skill: Artifact): readonly Diagnostic[] => {
  const name = skill.metadata.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    return invalidMetadata(skill, "requires a non-empty name");
  }
  if (name.length > 64) {
    return invalidMetadata(skill, "name exceeds 64 characters");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    return invalidMetadata(
      skill,
      "name must use lowercase alphanumeric characters separated by single hyphens",
    );
  }
  const directoryName = basename(dirname(skill.source));
  if (name !== directoryName) {
    return invalidMetadata(skill, `name must match parent directory ${directoryName}`);
  }
  return [];
};

const descriptionDiagnostics = (skill: Artifact): readonly Diagnostic[] => {
  const description = skill.metadata.description;
  if (typeof description !== "string" || description.trim().length === 0) {
    return invalidMetadata(skill, "requires a non-empty description");
  }
  if (description.length <= 1024) return [];
  return invalidMetadata(
    skill,
    "description exceeds 1024 characters",
    "agent-skills/trigger-compat",
  );
};

const optionalStringDiagnostics = (
  skill: Artifact,
  field: "license" | "allowed-tools",
): readonly Diagnostic[] => {
  const value = skill.metadata[field];
  if (value === undefined || typeof value === "string") return [];
  return invalidMetadata(skill, `${field} must be a string`);
};

const compatibilityDiagnostics = (skill: Artifact): readonly Diagnostic[] => {
  const compatibility = skill.metadata.compatibility;
  if (compatibility === undefined) return [];
  if (typeof compatibility !== "string") {
    return invalidMetadata(skill, "compatibility must be a string");
  }
  if (compatibility.trim().length === 0) {
    return invalidMetadata(skill, "compatibility must be non-empty");
  }
  if (compatibility.length <= 500) return [];
  return invalidMetadata(skill, "compatibility exceeds 500 characters");
};

const metadataDiagnostics = (skill: Artifact): readonly Diagnostic[] => {
  const metadata = skill.metadata.metadata;
  if (metadata === undefined) return [];
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return invalidMetadata(skill, "metadata must be a string-to-string object");
  }
  if (Object.values(metadata).every((value) => typeof value === "string")) return [];
  return invalidMetadata(skill, "metadata must contain only string values");
};

const driftDiagnostics = (
  skill: Artifact,
  platforms: readonly PlatformDefinition[],
): readonly Diagnostic[] =>
  platforms.flatMap((platform) =>
    Object.keys(skill.metadata)
      .filter((field) => !platform.allowedSkillFields.includes(field))
      .map((field): Diagnostic => ({
        rule: "agent-skills/frontmatter-drift",
        severity: "warn",
        message: `${platform.id} ignores skill field ${field}`,
        path: skill.source,
        artifactId: skill.id,
        plugin: `farmall:${platform.id}`,
      })),
  );

export const skillMetadataLintPlugin: LintPlugin = {
  apiVersion: 1,
  id: "farmall:lint",
  kind: "lint",
  validate: (options) => {
    const parsed = parseOptions(options);
    if (!parsed.ok) return parsed;
    return ok(undefined);
  },
  run: async (emissions, rawOptions) => {
    const options = parseOptions(rawOptions);
    if (!options.ok) return options;
    const platforms = selectedPlatforms(options.value);
    const skills = emissions.filter(
      (emission): emission is Artifact =>
        emission.type === "artifact" && emission.kind === "skills",
    );
    return ok(
      skills.flatMap((skill) => [
        ...nameDiagnostics(skill),
        ...descriptionDiagnostics(skill),
        ...optionalStringDiagnostics(skill, "license"),
        ...optionalStringDiagnostics(skill, "allowed-tools"),
        ...compatibilityDiagnostics(skill),
        ...metadataDiagnostics(skill),
        ...driftDiagnostics(skill, platforms),
      ]),
    );
  },
};
