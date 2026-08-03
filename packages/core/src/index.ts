export const FARMALL_VERSION = "0.0.1" as const;

/** Local Result until we wire in massaman's `Result<T, E>`. */
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export * from "./types.ts";
export * from "./config.ts";
export * from "./matrix.ts";
export * from "./inventory.ts";
export * from "./plan.ts";
export * from "./lint.ts";

import type { Target } from "./types.ts";
import { isTarget } from "./types.ts";

/** @deprecated legacy alias for {@link Target}. */
export type SyncTarget = Target;

/** @deprecated legacy alias — use {@link isTarget}. */
export const isSyncTarget = (value: string): value is Target => isTarget(value);

/** @deprecated legacy stub — real projection lives in the CLI commands now. */
export const sync = (target: Target): Result<string> => ok(`sync ${target} — not implemented yet`);

/** @deprecated legacy stub. */
export const lintSkills = (): Result<string> => ok("lint skills — not implemented yet");
