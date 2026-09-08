export interface ApplyResult {
  readonly created: number;
  readonly updated: number;
  readonly deleted: number;
  readonly unchanged: number;
  readonly warnings?: readonly ApplyWarning[];
}

export interface ApplyWarning {
  readonly code: "stale-lock-recovered" | "lock-cleanup" | "journal-cleanup";
  readonly message: string;
  readonly path: string;
}
