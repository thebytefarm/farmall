import { z } from "zod";

import type { JsonObject, JsonValue } from "./types.ts";

const isJsonNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const hasOnlyArrayElements = (value: readonly unknown[]): boolean =>
  Reflect.ownKeys(value).every((key) => {
    if (key === "length") return true;
    if (typeof key !== "string") return false;
    const index = Number(key);
    return Number.isInteger(index) && index >= 0 && index < value.length && String(index) === key;
  }) && Reflect.ownKeys(value).length === value.length + 1;

const isPlainRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isJsonObject = (value: unknown, ancestors: readonly unknown[]): value is JsonObject => {
  if (!isPlainRecord(value) || ancestors.includes(value)) return false;
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor))
      return false;
    return isJsonValue(descriptor.value, [...ancestors, value]);
  });
};

export const isJsonValue = (
  value: unknown,
  ancestors: readonly unknown[] = [],
): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (isJsonNumber(value)) return true;
  if (Array.isArray(value)) {
    if (ancestors.includes(value) || !hasOnlyArrayElements(value)) return false;
    return value.every((item) => isJsonValue(item, [...ancestors, value]));
  }
  return isJsonObject(value, ancestors);
};

export const jsonValueSchema = z.custom<JsonValue>(isJsonValue, "Expected a JSON value");
export const jsonObjectSchema = z.custom<JsonObject>(
  (value): value is JsonObject => isJsonObject(value, []),
  "Expected a JSON object",
);
