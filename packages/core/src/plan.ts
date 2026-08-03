import type { Artifact } from "./inventory.ts";
import type { Platform, Target } from "./types.ts";
import { artifactsFor } from "./inventory.ts";
import { locationFor, supportFor } from "./matrix.ts";

/** What sync would do to a single artifact on a single platform. */
export type ActionStatus =
  | "create" // no link exists yet; sync would create it
  | "linked" // already symlinked and current
  | "update" // link exists but points at stale content
  | "partial" // convention-dependent; sync does its best
  | "unsupported"; // no home on this platform — skipped

export interface SyncAction {
  readonly target: Target;
  readonly platform: Platform;
  readonly artifact: string;
  readonly source: string;
  readonly dest: string;
  readonly status: ActionStatus;
}

/**
 * Deterministic faux status so repeated runs look stable. Derives a pretend
 * on-disk state from the artifact/platform names — no filesystem touched.
 */
const fauxStatus = (artifact: Artifact, platform: Platform, target: Target): ActionStatus => {
  const support = supportFor(target, platform);
  if (support === "none") return "unsupported";
  if (support === "partial") return "partial";
  const seed = (artifact.name.length + platform.length) % 5;
  if (seed === 0) return "create";
  if (seed === 1) return "update";
  return "linked";
};

const destFor = (target: Target, platform: Platform, artifact: Artifact): string => {
  const location = locationFor(target, platform);
  return location.replace("<name>", artifact.name);
};

/** Plan the full projection of a target out to a platform. */
export const planTarget = (target: Target, platform: Platform): readonly SyncAction[] =>
  artifactsFor(target).map((artifact) => ({
    target,
    platform,
    artifact: artifact.name,
    source: artifact.path,
    dest: destFor(target, platform, artifact),
    status: fauxStatus(artifact, platform, target),
  }));

/** Plan across many targets and platforms. */
export const planSync = (
  targets: readonly Target[],
  platforms: readonly Platform[],
): readonly SyncAction[] =>
  targets.flatMap((target) => platforms.flatMap((platform) => planTarget(target, platform)));

/** Roll a plan up into headline counts. */
export interface PlanTally {
  readonly create: number;
  readonly update: number;
  readonly linked: number;
  readonly partial: number;
  readonly unsupported: number;
  readonly total: number;
}

export const tally = (actions: readonly SyncAction[]): PlanTally => {
  const base = { create: 0, update: 0, linked: 0, partial: 0, unsupported: 0 };
  const counts = actions.reduce(
    (acc, action) => ({ ...acc, [action.status]: acc[action.status] + 1 }),
    base,
  );
  return { ...counts, total: actions.length };
};

/** Actions that would actually change the tree (create or update). */
export const pendingActions = (actions: readonly SyncAction[]): readonly SyncAction[] =>
  actions.filter((action) => action.status === "create" || action.status === "update");
