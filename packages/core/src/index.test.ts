import { describe, expect, it } from "vitest";
import { isSyncTarget, lintSkills, sync, SYNC_TARGETS } from "./index.ts";

describe("isSyncTarget", () => {
  it("accepts known targets", () => {
    for (const target of SYNC_TARGETS) {
      expect(isSyncTarget(target)).toBe(true);
    }
  });

  it("rejects unknown targets", () => {
    expect(isSyncTarget("nonsense")).toBe(false);
  });
});

describe("stubs", () => {
  it("sync returns ok", () => {
    expect(sync("skills")).toEqual({ ok: true, value: "sync skills — not implemented yet" });
  });

  it("lintSkills returns ok", () => {
    expect(lintSkills().ok).toBe(true);
  });
});
