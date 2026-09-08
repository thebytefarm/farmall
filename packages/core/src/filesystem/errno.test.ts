import { describe, expect, it } from "vitest";

import { errnoCode, hasErrno } from "./errno.ts";

describe("errno", () => {
  it("narrows only Error instances with string errno codes", () => {
    expect(errnoCode("ENOENT")).toBeUndefined();
    expect(errnoCode(new Error("missing"))).toBeUndefined();
    expect(errnoCode(Object.assign(new Error("invalid"), { code: 1 }))).toBeUndefined();
    expect(errnoCode(Object.assign(new Error("missing"), { code: "ENOENT" }))).toBe("ENOENT");
    expect(hasErrno(new Error("missing"), "ENOENT")).toBe(false);
    expect(hasErrno(Object.assign(new Error("missing"), { code: "ENOENT" }), "ENOENT")).toBe(true);
  });
});
