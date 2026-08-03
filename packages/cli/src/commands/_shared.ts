import type { CommandContext } from "maltty";
import type { ActionStatus, FarmallConfig, Platform, SyncAction, Target } from "@farmall/core";
import {
  enabledPlatforms,
  enabledTargets,
  isPlatform,
  isTarget,
  PLATFORM_LABELS,
  SYNC_TARGETS,
} from "@farmall/core";

/** `--config <path>` — path to a non-default config file. */
export const configOption = {
  config: { type: "string", description: "Path to a non-default config file." },
} as const;

/** `--platform <name>` — narrow an action to a single platform. */
export const platformOption = {
  platform: { type: "string", description: "Act on a single platform." },
} as const;

/** `--dry-run` — report changes without writing. */
export const dryRunOption = {
  "dry-run": { type: "boolean", description: "Show what would change without writing." },
} as const;

/** `--format <pretty|json>` — output rendering. */
export const formatOption = {
  format: {
    type: "string",
    description: "Output format.",
    choices: ["pretty", "json"] as const,
    default: "pretty",
  },
} as const;

/** Optional `target` positional, constrained to the known targets. */
export const targetPositional = {
  target: {
    type: "string",
    description: "Target to act on (default: all enabled targets).",
    choices: SYNC_TARGETS,
  },
} as const;

/**
 * Locally-typed view over `ctx.args`. maltty's yargs-native arg form doesn't
 * flow literal types into `ctx.args` in this rc, so we read through this shape
 * instead of casting at every call site.
 */
export interface FarmallArgs {
  readonly target?: string;
  readonly platform?: string;
  readonly config?: string;
  /** yargs camel-cases `--dry-run` to `dryRun`. */
  readonly dryRun?: boolean;
  readonly format?: string;
  readonly source?: string;
  readonly platforms?: readonly string[];
}

export const readArgs = (ctx: CommandContext): FarmallArgs => ctx.args as FarmallArgs;

/** Resolve the target set: an explicit positional, or every enabled target. */
export const resolveTargets = (config: FarmallConfig, raw?: string): readonly Target[] => {
  if (raw === undefined) return enabledTargets(config);
  if (!isTarget(raw)) return [];
  return [raw];
};

/** Resolve the platform set: an explicit `--platform`, or every enabled one. */
export const resolvePlatforms = (config: FarmallConfig, raw?: string): readonly Platform[] => {
  if (raw === undefined) return enabledPlatforms(config);
  if (!isPlatform(raw)) return [];
  return [raw];
};

/** Guard + friendly error for a bad `target` positional. */
export const assertTarget = (ctx: CommandContext, raw: string | undefined): void => {
  if (raw !== undefined && !isTarget(raw)) {
    ctx.fail(`Unknown target "${raw}". Expected one of: ${SYNC_TARGETS.join(", ")}.`);
  }
};

/** Guard + friendly error for a bad `--platform`. */
export const assertPlatform = (ctx: CommandContext, raw: string | undefined): void => {
  if (raw !== undefined && !isPlatform(raw)) {
    ctx.fail(`Unknown platform "${raw}".`);
  }
};

/** Map a plan action status onto a maltty check-row status. */
const CHECK_STATUS: Readonly<Record<ActionStatus, "pass" | "warn" | "skip" | "fix">> = {
  create: "fix",
  update: "fix",
  linked: "pass",
  partial: "warn",
  unsupported: "skip",
};

const STATUS_DETAIL: Readonly<Record<ActionStatus, string>> = {
  create: "create link",
  update: "relink (stale)",
  linked: "up to date",
  partial: "convention-dependent",
  unsupported: "no home here",
};

/** Group actions by platform, preserving first-seen order. */
export const groupByPlatform = (
  actions: readonly SyncAction[],
): ReadonlyMap<Platform, readonly SyncAction[]> => {
  const groups = new Map<Platform, SyncAction[]>();
  for (const action of actions) {
    const bucket = groups.get(action.platform) ?? [];
    bucket.push(action);
    groups.set(action.platform, bucket);
  }
  return groups;
};

/** Render a plan as grouped check rows via the report middleware. */
export const renderActions = (ctx: CommandContext, actions: readonly SyncAction[]): void => {
  for (const [platform, group] of groupByPlatform(actions)) {
    ctx.log.step(ctx.colors.bold(PLATFORM_LABELS[platform]));
    for (const action of group) {
      ctx.report.check({
        status: CHECK_STATUS[action.status],
        name: action.dest,
        detail: STATUS_DETAIL[action.status],
        hint: action.artifact,
      });
    }
  }
};
