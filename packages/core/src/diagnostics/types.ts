export type Severity = "error" | "warn" | "info";

export interface Diagnostic {
  readonly rule: string;
  readonly severity: Severity;
  readonly message: string;
  readonly path?: string | undefined;
  readonly artifactId?: string | undefined;
  readonly plugin?: string | undefined;
  readonly help?: string | undefined;
}

export interface CoreError {
  readonly code: "config" | "plugin" | "source" | "lint" | "conflict" | "plan" | "apply";
  readonly message: string;
  readonly path?: string | undefined;
  readonly plugin?: string | undefined;
}
