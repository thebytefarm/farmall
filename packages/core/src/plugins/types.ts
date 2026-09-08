import type { Emission, FileRecord } from "../artifacts/types.ts";
import type { CoreError, Diagnostic } from "../diagnostics/types.ts";
import type { DesiredFile } from "../planning/types.ts";
import type { Result } from "../result.ts";

export interface StageResult<T> {
  readonly value: T;
  readonly diagnostics: readonly Diagnostic[];
}

export interface PluginContext {
  readonly root: string;
  readonly read: (path: string) => Promise<Result<string, CoreError>>;
  readonly readBytes: (path: string) => Promise<Result<Uint8Array, CoreError>>;
  readonly readFileRecord: (path: string) => Promise<Result<FileRecord, CoreError>>;
  readonly glob: (
    patterns: string | readonly string[],
  ) => Promise<Result<readonly string[], CoreError>>;
  readonly walk: (path: string) => Promise<Result<readonly string[], CoreError>>;
}

export interface PluginBase {
  readonly apiVersion: 1;
  readonly id: string;
  readonly validate?: (options: Readonly<Record<string, unknown>>) => Result<void, CoreError>;
}

export interface SourcePlugin extends PluginBase {
  readonly kind: "source";
  readonly run: (
    options: Readonly<Record<string, unknown>>,
    context: PluginContext,
  ) => Promise<Result<StageResult<readonly Emission[]>, CoreError>>;
}

export interface TransformPlugin extends PluginBase {
  readonly kind: "transform";
  readonly run: (
    emissions: readonly Emission[],
    options: Readonly<Record<string, unknown>>,
    context: PluginContext,
  ) => Promise<Result<StageResult<readonly Emission[]>, CoreError>>;
}

export interface LintPlugin extends PluginBase {
  readonly kind: "lint";
  readonly run: (
    emissions: readonly Emission[],
    options: Readonly<Record<string, unknown>>,
    context: PluginContext,
  ) => Promise<Result<readonly Diagnostic[], CoreError>>;
}

export interface OutputPlugin extends PluginBase {
  readonly kind: "output";
  readonly run: (
    emissions: readonly Emission[],
    options: Readonly<Record<string, unknown>>,
    context: PluginContext,
  ) => Promise<Result<StageResult<readonly DesiredFile[]>, CoreError>>;
}

export type FarmallPlugin = SourcePlugin | TransformPlugin | LintPlugin | OutputPlugin;
export type PluginKind = FarmallPlugin["kind"];

export interface PluginUse {
  readonly use: string;
  readonly name?: string;
  readonly options?: Readonly<Record<string, unknown>>;
}
