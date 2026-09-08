import { createHash } from "node:crypto";

import type { FileContent } from "../artifacts/types.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export const contentBytes = (content: FileContent): Uint8Array => {
  if (typeof content === "string") return encoder.encode(content);
  return content;
};

export const cloneContent = (content: FileContent): FileContent => {
  if (typeof content === "string") return content;
  return new Uint8Array(content);
};

export const contentEquals = (left: FileContent | null, right: FileContent | null): boolean => {
  if (left === null || right === null) return left === right;
  const leftBytes = contentBytes(left);
  const rightBytes = contentBytes(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  return leftBytes.every((byte, index) => byte === rightBytes[index]);
};

export const contentDigest = (content: FileContent): string =>
  createHash("sha256").update(contentBytes(content)).digest("hex");

export const textContent = (content: FileContent): string | null => {
  if (typeof content === "string") return content;
  if (content.includes(0)) return null;
  try {
    return decoder.decode(content);
  } catch {
    return null;
  }
};
