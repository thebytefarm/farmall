import { z } from "zod";

import { jsonObjectSchema } from "../artifacts/json-value.ts";
import type { Emission } from "../artifacts/types.ts";
import type { CoreError, Diagnostic } from "../diagnostics/types.ts";
import { validateRelativePath } from "../filesystem/contained-path.ts";
import type { DesiredFile } from "../planning/types.ts";
import type { Result } from "../result.ts";
import type { StageResult } from "./types.ts";

const nonEmptyString = z.string().min(1);
const relativePath = nonEmptyString.refine((path) => validateRelativePath(path, "plugin").ok);
const fileContent = z.union([z.string(), z.instanceof(Uint8Array)]);
const posixMode = z.number().int().min(0).max(0o7777);

export const coreErrorSchema = z
  .object({
    code: z.enum(["config", "plugin", "source", "lint", "conflict", "plan", "apply"]),
    message: nonEmptyString,
    path: z.string().optional(),
    plugin: z.string().optional(),
  })
  .strict();

export const diagnosticSchema = z
  .object({
    rule: nonEmptyString,
    severity: z.enum(["error", "warn", "info"]),
    message: nonEmptyString,
    path: z.string().optional(),
    artifactId: z.string().optional(),
    plugin: z.string().optional(),
    help: z.string().optional(),
  })
  .strict();

const artifactFileSchema = z
  .object({ path: relativePath, content: fileContent, mode: posixMode.optional() })
  .strict();

export const artifactSchema = z
  .object({
    type: z.literal("artifact"),
    id: nonEmptyString,
    kind: z.enum(["instructions", "rules", "skills", "subagents"]),
    name: nonEmptyString,
    source: nonEmptyString,
    content: z.string(),
    metadata: jsonObjectSchema,
    files: z.array(artifactFileSchema),
  })
  .strict();

export const directOutputSchema = z
  .object({
    type: z.literal("output"),
    id: nonEmptyString,
    output: nonEmptyString,
    files: z.array(artifactFileSchema),
    source: nonEmptyString,
  })
  .strict();

export const emissionSchema = z.discriminatedUnion("type", [artifactSchema, directOutputSchema]);

export const desiredFileSchema = z
  .object({
    path: relativePath,
    content: fileContent,
    mode: posixMode.optional(),
    output: nonEmptyString,
    plugin: nonEmptyString,
    sources: z.array(nonEmptyString),
    writePolicy: z.enum(["managed", "create-only"]),
  })
  .strict();

const resultSchema = <T>(value: z.ZodType<T>): z.ZodType<Result<T, CoreError>> =>
  z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), value }).strict(),
    z.object({ ok: z.literal(false), error: coreErrorSchema }).strict(),
  ]);

const stageResultSchema = <T>(value: z.ZodType<T>): z.ZodType<StageResult<T>> =>
  z.object({ value, diagnostics: z.array(diagnosticSchema) }).strict();

export const sourceResultSchema: z.ZodType<Result<StageResult<readonly Emission[]>, CoreError>> =
  resultSchema(stageResultSchema(z.array(emissionSchema)));
export const transformResultSchema: z.ZodType<Result<StageResult<readonly Emission[]>, CoreError>> =
  resultSchema(stageResultSchema(z.array(emissionSchema)));
export const lintResultSchema: z.ZodType<Result<readonly Diagnostic[], CoreError>> = resultSchema(
  z.array(diagnosticSchema),
);
export const outputResultSchema: z.ZodType<Result<StageResult<readonly DesiredFile[]>, CoreError>> =
  resultSchema(stageResultSchema(z.array(desiredFileSchema)));
export const validationResultSchema: z.ZodType<Result<void, CoreError>> = resultSchema(
  z.undefined(),
);
