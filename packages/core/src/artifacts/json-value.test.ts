import { describe, expect, it } from "vitest";

import { isJsonValue, jsonObjectSchema, jsonValueSchema } from "./json-value.ts";

const cyclicObject = (): Readonly<Record<string, unknown>> => {
  const value: Record<string, unknown> = {};
  Object.defineProperty(value, "self", { enumerable: true, value });
  return value;
};

describe("JSON values", () => {
  it("accepts nested JSON values and null-prototype objects", () => {
    const nullPrototype = Object.assign(Object.create(null), { enabled: true });
    const value = {
      string: "farmall",
      number: 42,
      boolean: false,
      null: null,
      nested: [nullPrototype, [1, 2]],
    };

    expect(isJsonValue(value)).toBe(true);
    expect(jsonValueSchema.safeParse(value).success).toBe(true);
    expect(jsonObjectSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ["bigint", BigInt(1)],
    ["undefined", undefined],
    ["function", () => "nope"],
    ["symbol", Symbol("nope")],
    ["non-finite number", Number.POSITIVE_INFINITY],
    ["typed array", new Uint8Array([1])],
    ["class instance", new Date(0)],
    ["cycle", cyclicObject()],
    ["sparse array", Array(1)],
    ["symbol-keyed array", Object.assign([], { [Symbol("nope")]: true })],
    ["symbol-keyed object", { [Symbol("nope")]: true }],
    ["accessor", Object.defineProperty({}, "value", { enumerable: true, get: () => "nope" })],
    ["non-enumerable value", Object.defineProperty({}, "value", { value: "nope" })],
  ])("rejects %s values", (_name, value) => {
    expect(isJsonValue(value)).toBe(false);
    expect(jsonValueSchema.safeParse(value).success).toBe(false);
  });

  it("rejects non-object roots from the object schema", () => {
    expect(jsonObjectSchema.safeParse(null).success).toBe(false);
  });
});
