import {
  err,
  ok,
  type ApplyResult,
  type CoreError,
  type PipelineRun,
  type Result,
} from "@farmall/core";

const pathSuffix = (path: string | undefined): string => {
  if (path === undefined) return "";
  return ` ${path}`;
};

const reasonSuffix = (reason: string | undefined): string => {
  if (reason === undefined) return "";
  return ` (${reason})`;
};

export const renderRun = (run: PipelineRun): string => {
  const diagnostics = run.diagnostics.map(
    (diagnostic) =>
      `${diagnostic.severity.toUpperCase()} ${diagnostic.rule}${pathSuffix(diagnostic.path)}: ${diagnostic.message}`,
  );
  const actions = run.plan.actions.map(
    (action) =>
      `${action.action.toUpperCase().padEnd(8)} ${action.path}${reasonSuffix(action.reason)}`,
  );
  const summary = `${run.emissions.length} artifacts, ${run.desired.length} outputs, ${run.diagnostics.length} diagnostics`;
  return `${[...diagnostics, ...actions, summary].join("\n")}\n`;
};

export const renderApplied = (result: ApplyResult): string =>
  `created ${result.created}, updated ${result.updated}, deleted ${result.deleted}, unchanged ${result.unchanged}\n`;

function jsonSafe(this: Readonly<Record<string, unknown>>, key: string, value: unknown): unknown {
  const original = this[key];
  if (original instanceof Uint8Array) {
    return {
      encoding: "base64",
      data: Buffer.from(original).toString("base64"),
    };
  }
  if (value === undefined) {
    if (key !== "") return undefined;
    throw new TypeError("Unsupported top-level JSON value: undefined");
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`Unsupported JSON value: ${typeof value}`);
  }
  return value;
}

const serializationErrorDetail = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "unsupported value";
};

export const renderJson = (value: unknown): Result<string, CoreError> => {
  try {
    const rendered = JSON.stringify(value, jsonSafe, 2);
    if (rendered === undefined) {
      return err({ code: "config", message: "Unable to serialize JSON output" });
    }
    return ok(`${rendered}\n`);
  } catch (error) {
    return err({
      code: "config",
      message: `Unable to serialize JSON output: ${serializationErrorDetail(error)}`,
    });
  }
};
