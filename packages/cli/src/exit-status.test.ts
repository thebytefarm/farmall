import type { CoreError, Diagnostic, PlanAction } from "@farmall/core";
import { describe, expect, it } from "vitest";

import { exitCodeFor, hasChanges, hasErrors } from "./exit-status.ts";

const action = (kind: PlanAction["action"]): Pick<PlanAction, "action"> => ({ action: kind });

describe("exitCodeFor", () => {
  it.each([
    ["lint", 1],
    ["config", 3],
    ["plugin", 3],
    ["source", 3],
    ["conflict", 4],
    ["plan", 4],
    ["apply", 4],
  ] satisfies readonly (readonly [CoreError["code"], number])[])(
    "returns the expected exit code for %s errors",
    (code, expected) => {
      expect(exitCodeFor({ code, message: "failure" })).toBe(expected);
    },
  );
});

describe("hasErrors", () => {
  it("returns true when any diagnostic is an error", () => {
    const diagnostics: readonly Diagnostic[] = [
      { rule: "warning", severity: "warn", message: "warning" },
      { rule: "failure", severity: "error", message: "failure" },
    ];

    expect(hasErrors(diagnostics)).toBe(true);
  });

  it("returns false when diagnostics contain no errors", () => {
    expect(hasErrors([{ rule: "notice", severity: "info", message: "notice" }])).toBe(false);
  });
});

describe("hasChanges", () => {
  it.each(["create", "update", "delete", "conflict"] satisfies readonly PlanAction["action"][])(
    "returns true for a %s action",
    (kind) => {
      expect(hasChanges([action(kind)])).toBe(true);
    },
  );

  it("returns false for only no-op actions", () => {
    expect(hasChanges([action("noop")])).toBe(false);
  });
});
