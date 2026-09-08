import { describe, expect, it } from "vitest";

import { applySeverity } from "./severity.ts";

describe("applySeverity", () => {
  it("applies overrides, removes disabled rules, and sorts diagnostics", () => {
    const diagnostics = applySeverity(
      [
        { rule: "zulu", severity: "info", message: "zulu" },
        { rule: "off", severity: "warn", message: "off", path: "a.md" },
        { rule: "promote", severity: "warn", message: "promote", path: "b.md" },
        { rule: "alpha", severity: "info", message: "alpha" },
        { rule: "alpha", severity: "info", message: "alpha" },
      ],
      { off: "off", promote: "error" },
    );

    expect(diagnostics.map(({ rule, severity }) => ({ rule, severity }))).toEqual([
      { rule: "alpha", severity: "info" },
      { rule: "alpha", severity: "info" },
      { rule: "zulu", severity: "info" },
      { rule: "promote", severity: "error" },
    ]);
  });
});
