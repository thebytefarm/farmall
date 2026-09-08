import { readOptionalFileRecord } from "./file-record.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import type { CoreError } from "../diagnostics/types.ts";

export const readOptionalText = async (
  root: string,
  path: string,
  code: CoreError["code"] = "plan",
): Promise<Result<string | null, CoreError>> => {
  const record = await readOptionalFileRecord(root, path, code);
  if (!record.ok) return record;
  if (record.value === null) return ok(null);
  try {
    return ok(new TextDecoder("utf-8", { fatal: true }).decode(record.value.content));
  } catch (error) {
    return err({ code, message: errorMessage(error), path });
  }
};
