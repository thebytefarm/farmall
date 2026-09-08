import { describe, expect, it } from "vitest";

import { digest } from "./content-digest.ts";
import { cloneContent, contentBytes, contentEquals, textContent } from "./file-content.ts";

describe("digest", () => {
  it("returns stable SHA-256 content digests", () => {
    expect(digest("farmall")).toBe(
      "92b7423a172221807e0a7cda2f33c3e93ab654dcfc0b843938b04a15b615d8f1",
    );
    expect(digest("farmall")).not.toBe(digest("Farmall"));
  });

  it("compares, clones, decodes, and hashes byte content", () => {
    const bytes = new Uint8Array([102, 97, 114, 109, 97, 108, 108]);
    const cloned = cloneContent(bytes);
    expect(contentBytes("farmall")).toEqual(bytes);
    expect(cloned).toEqual(bytes);
    expect(cloned).not.toBe(bytes);
    expect(cloneContent("farmall")).toBe("farmall");
    expect(contentEquals("farmall", bytes)).toBe(true);
    expect(contentEquals(null, null)).toBe(true);
    expect(contentEquals(null, bytes)).toBe(false);
    expect(contentEquals(bytes, new Uint8Array([1]))).toBe(false);
    expect(contentEquals(bytes, new Uint8Array([102, 0, 0, 0, 0, 0, 0]))).toBe(false);
    expect(digest(bytes)).toBe(digest("farmall"));
    expect(textContent(bytes)).toBe("farmall");
    expect(textContent("text")).toBe("text");
    expect(textContent(new Uint8Array([0, 65]))).toBeNull();
    expect(textContent(new Uint8Array([0xff]))).toBeNull();
  });
});
