import { sortBy } from "massaman/array";
import { match } from "massaman/match";

import type { Diagnostic } from "../diagnostics/types.ts";
import type { FarmallConfig } from "./types.ts";

export const applySeverity = (
  diagnostics: readonly Diagnostic[],
  severity: FarmallConfig["severity"],
): readonly Diagnostic[] => {
  const configured = diagnostics.flatMap((diagnostic) =>
    match(severity?.[diagnostic.rule])
      .with("off", () => [])
      .with(undefined, () => [diagnostic])
      .otherwise((level) => [{ ...diagnostic, severity: level }]),
  );
  return sortBy(configured, [
    (diagnostic) => `${diagnostic.path ?? ""}:${diagnostic.rule}:${diagnostic.message}`,
  ]);
};
