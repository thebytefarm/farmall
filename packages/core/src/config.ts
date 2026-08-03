import type { FarmallConfig, Platform, Target } from "./types.ts";
import { PLATFORMS, SYNC_TARGETS } from "./types.ts";

/**
 * Identity helper for authoring `farmall.config.ts` with editor types.
 * Returns the config unchanged — exists for inference and validation.
 */
export const defineConfig = (config: FarmallConfig): FarmallConfig => config;

/** The config we pretend to have discovered when none is on disk. */
export const DEFAULT_CONFIG: FarmallConfig = {
  source: ".farmall",
  platforms: [...PLATFORMS],
  sync: {
    instructions: { format: "agents-md" },
    rules: true,
    skills: { include: "skills/**", exclude: "**/*.wip/**" },
    subagents: true,
    agents: false,
  },
  lint: {
    rules: {
      "trigger-compat": "error",
      "frontmatter-drift": "warn",
      portability: "error",
    },
    overrides: [{ platform: "codex", rules: { "frontmatter-drift": "off" } }],
  },
};

/** Faux config-file discovery. Pretends we resolved a config from cwd. */
export interface ResolvedConfig {
  readonly path: string;
  readonly config: FarmallConfig;
}

export const loadConfig = (explicitPath?: string): ResolvedConfig => ({
  path: explicitPath ?? "farmall.config.ts",
  config: DEFAULT_CONFIG,
});

/** Platforms the config opts into (falls back to the full set). */
export const enabledPlatforms = (config: FarmallConfig): readonly Platform[] =>
  config.platforms.length > 0 ? config.platforms : [...PLATFORMS];

/** Targets the config leaves enabled — only an explicit `false` disables one. */
export const enabledTargets = (config: FarmallConfig): readonly Target[] =>
  SYNC_TARGETS.filter((target) => config.sync?.[target] !== false);
