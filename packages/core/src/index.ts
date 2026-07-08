export const FARMALL_VERSION = "0.0.0" as const;

/** Local Result until we wire in massaman's `Result<T, E>`. */
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** What the CLI can push out to agent platforms. */
export const SYNC_TARGETS = ["instructions", "rules", "skills", "subagents", "agents"] as const;
export type SyncTarget = (typeof SYNC_TARGETS)[number];

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

export const isSyncTarget = (value: string): value is SyncTarget =>
  (SYNC_TARGETS as readonly string[]).includes(value);

export const sync = (target: SyncTarget): Result<string> =>
  ok(`sync ${target} — not implemented yet`);

export const lintSkills = (): Result<string> => ok("lint skills — not implemented yet");
