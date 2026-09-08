import type { CoreError, Diagnostic, PlanAction } from "@farmall/core";
import { match } from "massaman/match";

export const exitCodeFor = (error: CoreError): number =>
  match(error.code)
    .with("lint", () => 1)
    .with("config", "plugin", "source", () => 3)
    .with("conflict", "plan", "apply", () => 4)
    .exhaustive();

export const hasErrors = (diagnostics: readonly Diagnostic[]): boolean =>
  diagnostics.some((diagnostic) => diagnostic.severity === "error");

export const hasChanges = (actions: readonly Pick<PlanAction, "action">[]): boolean =>
  actions.some((action) =>
    match(action.action)
      .with("create", "update", "delete", "conflict", () => true)
      .with("noop", () => false)
      .exhaustive(),
  );
