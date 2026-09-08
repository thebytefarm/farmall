import { mkdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { readOptionalFileRecord } from "./file-record.ts";
import { withTestFilesystem } from "../test-filesystem.ts";

describe("readOptionalFileRecord", () => {
  it("distinguishes missing paths from non-file leaves", async () =>
    withTestFilesystem(async (root) => {
      await expect(readOptionalFileRecord(root, "missing")).resolves.toEqual({
        ok: true,
        value: null,
      });
      await mkdir(`${root}/directory`);
      await expect(readOptionalFileRecord(root, "directory")).resolves.toMatchObject({
        ok: false,
        error: { message: "Output path is not a file" },
      });
    }));
});
