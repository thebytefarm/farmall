import type { FileContent, PosixMode } from "../artifacts/types.ts";

export type WritePolicy = "managed" | "create-only";

export interface DesiredFile {
  readonly path: string;
  readonly content: FileContent;
  readonly mode?: PosixMode | undefined;
  readonly output: string;
  readonly plugin: string;
  readonly sources: readonly string[];
  readonly writePolicy: WritePolicy;
}

export interface ManifestEntry {
  readonly path: string;
  readonly pipeline?: string;
  readonly output: string;
  readonly plugin: string;
  readonly sources: readonly string[];
  readonly digest: string;
}

export interface Manifest {
  readonly version: 1;
  readonly entries: readonly ManifestEntry[];
}

export type PlanActionKind = "create" | "update" | "delete" | "noop" | "conflict";

interface PlanActionBase {
  readonly path: string;
  readonly output: string;
}

export interface CreatePlanAction extends PlanActionBase {
  readonly action: "create";
  readonly before?: never;
  readonly after: FileContent;
  readonly afterMode?: PosixMode | undefined;
  readonly reason?: never;
  readonly desired: DesiredFile;
}

export interface UpdatePlanAction extends PlanActionBase {
  readonly action: "update";
  readonly before: FileContent;
  readonly after: FileContent;
  readonly beforeMode: PosixMode;
  readonly afterMode?: PosixMode | undefined;
  readonly reason?: never;
  readonly desired: DesiredFile;
}

export interface DeletePlanAction extends PlanActionBase {
  readonly action: "delete";
  readonly before: FileContent;
  readonly beforeMode: PosixMode;
  readonly after?: never;
  readonly reason?: never;
  readonly desired?: never;
}

export interface DesiredNoopPlanAction extends PlanActionBase {
  readonly action: "noop";
  readonly before: FileContent;
  readonly after: FileContent;
  readonly beforeMode?: PosixMode | undefined;
  readonly afterMode?: PosixMode | undefined;
  readonly reason?: never;
  readonly desired: DesiredFile;
}

export interface AbsentNoopPlanAction extends PlanActionBase {
  readonly action: "noop";
  readonly before?: never;
  readonly after?: never;
  readonly reason: "managed output is already absent";
  readonly desired?: never;
}

export interface DesiredConflictPlanAction extends PlanActionBase {
  readonly action: "conflict";
  readonly before?: FileContent;
  readonly after: FileContent;
  readonly beforeMode?: PosixMode | undefined;
  readonly afterMode?: PosixMode | undefined;
  readonly reason: string;
  readonly desired: DesiredFile;
}

export interface StaleConflictPlanAction extends PlanActionBase {
  readonly action: "conflict";
  readonly before: FileContent;
  readonly beforeMode?: PosixMode | undefined;
  readonly after?: never;
  readonly reason: string;
  readonly desired?: never;
}

export type PlanAction =
  | CreatePlanAction
  | UpdatePlanAction
  | DeletePlanAction
  | DesiredNoopPlanAction
  | AbsentNoopPlanAction
  | DesiredConflictPlanAction
  | StaleConflictPlanAction;

export interface Plan {
  readonly root: string;
  readonly statePath: string;
  readonly pipeline?: string;
  readonly previousManifest?: Manifest;
  readonly actions: readonly PlanAction[];
  readonly manifest: Manifest;
}

export interface ApplicablePlan extends Plan {
  readonly previousManifest: Manifest;
}
