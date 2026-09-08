export const ARTIFACT_KINDS = ["instructions", "rules", "skills", "subagents"] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export type FileContent = string | Uint8Array;
export type PosixMode = number;
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface ArtifactFile {
  readonly path: string;
  readonly content: FileContent;
  readonly mode?: PosixMode | undefined;
}

export interface FileRecord {
  readonly content: Uint8Array;
  readonly mode: PosixMode;
}

export interface Artifact {
  readonly type: "artifact";
  readonly id: string;
  readonly kind: ArtifactKind;
  readonly name: string;
  readonly source: string;
  readonly content: string;
  readonly metadata: JsonObject;
  readonly files: readonly ArtifactFile[];
}

export interface DirectOutput {
  readonly type: "output";
  readonly id: string;
  readonly output: string;
  readonly files: readonly ArtifactFile[];
  readonly source: string;
}

export type Emission = Artifact | DirectOutput;
