import type { Diagnostic, FarmallPlugin, OutputPlugin, StageResult } from "../types.ts";
import { filesystemSourcePlugin } from "./filesystem-source.ts";
import { PLATFORM_DEFINITIONS } from "./platform-definitions.ts";
import { filesystemOutputPlugin, createPlatformOutputPlugin } from "./platform-output.ts";
import { platformSourcePlugin } from "./platform-source.ts";
import { skillMetadataLintPlugin } from "./skill-metadata-lint.ts";

export { filesystemSource, filesystemSourcePlugin } from "./filesystem-source.ts";
export { platformIds } from "./platform-definitions.ts";
export { filesystemOutput, filesystemOutputPlugin } from "./platform-output.ts";
export { platformSource, platformSourcePlugin } from "./platform-source.ts";

export const BUILTIN_PLUGINS: readonly FarmallPlugin[] = [
  filesystemSourcePlugin,
  platformSourcePlugin,
  skillMetadataLintPlugin,
  filesystemOutputPlugin,
  ...PLATFORM_DEFINITIONS.map((definition) => createPlatformOutputPlugin(definition)),
];

export const builtInOutput = (id: string): OutputPlugin | undefined =>
  BUILTIN_PLUGINS.find(
    (plugin): plugin is OutputPlugin => plugin.kind === "output" && plugin.id === `farmall:${id}`,
  );

export const stage = <T>(value: T, diagnostics: readonly Diagnostic[] = []): StageResult<T> => ({
  value,
  diagnostics,
});
