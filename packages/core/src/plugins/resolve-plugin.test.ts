import { describe, expect, it } from "vitest";

import { err, ok } from "../result.ts";
import { immutablePluginOptions, resolvePlugin } from "./resolve-plugin.ts";
import type { SourcePlugin } from "./types.ts";

const sourcePlugin = (id: string): SourcePlugin => ({
  apiVersion: 1,
  id,
  kind: "source",
  run: async () => ok({ value: [], diagnostics: [] }),
});

const cyclicArray = (): readonly unknown[] => {
  const value: unknown[] = [];
  Object.defineProperty(value, "0", { enumerable: true, value });
  return value;
};

const cyclicObject = (): Readonly<Record<string, unknown>> => {
  const value: Record<string, unknown> = {};
  Object.defineProperty(value, "self", { enumerable: true, value });
  return value;
};

describe("resolvePlugin", () => {
  it("returns the precise requested plugin kind", () => {
    const plugin = sourcePlugin("test:source");
    const result = resolvePlugin([plugin], { use: plugin.id }, "source");

    expect(result).toEqual({ ok: true, value: plugin });
    if (!result.ok) return;
    expect(result.value.kind).toBe("source");
  });

  it("runs option validation with frozen cloned options", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const options = { nested: { enabled: true, bytes, byteArrays: [bytes] } };
    const plugin: SourcePlugin = {
      ...sourcePlugin("test:validated"),
      validate: (received) => {
        expect(received).not.toBe(options);
        expect(Object.isFrozen(received)).toBe(true);
        expect(Object.isFrozen(received.nested)).toBe(true);
        const nested = received.nested as {
          readonly bytes: Uint8Array;
          readonly byteArrays: readonly Uint8Array[];
        };
        expect(nested.bytes).toEqual(bytes);
        expect(nested.bytes).not.toBe(bytes);
        expect(nested.bytes.buffer).toBeInstanceOf(ArrayBuffer);
        expect(Object.isFrozen(nested.bytes)).toBe(false);
        expect(Object.isFrozen(nested.byteArrays)).toBe(true);
        expect(nested.byteArrays[0]).not.toBe(bytes);
        return ok(undefined);
      },
    };

    expect(resolvePlugin([plugin], { use: plugin.id, name: "named", options }, "source")).toEqual({
      ok: true,
      value: plugin,
    });
  });

  it.each([
    ["function", () => "unsupported"],
    ["non-plain object", new Date(0)],
    ["cyclic array", cyclicArray()],
    ["cyclic object", cyclicObject()],
  ])("rejects unsupported %s options", (_name, value) => {
    expect(() => immutablePluginOptions({ use: "test:options", options: { value } })).toThrow();
  });

  it("clones and freezes null-prototype option records", () => {
    const value = Object.create(null, {
      enabled: { enumerable: true, value: true },
    }) as Readonly<Record<string, unknown>>;

    const options = immutablePluginOptions({ use: "test:options", options: { value } });

    expect(options.value).toEqual({ enabled: true });
    expect(Object.isFrozen(options.value)).toBe(true);
  });

  it("copies SharedArrayBuffer-backed byte options onto an ordinary buffer", () => {
    const shared = new SharedArrayBuffer(3);
    const bytes = new Uint8Array(shared);
    const plugin: SourcePlugin = {
      ...sourcePlugin("test:shared-options"),
      validate: (received) => {
        const cloned = received.bytes as Uint8Array;
        expect(cloned).not.toBe(bytes);
        expect(cloned.buffer).not.toBe(shared);
        expect(cloned.buffer).toBeInstanceOf(ArrayBuffer);
        return ok(undefined);
      },
    };

    expect(resolvePlugin([plugin], { use: plugin.id, options: { bytes } }, "source")).toEqual({
      ok: true,
      value: plugin,
    });
  });

  it("propagates valid validation failures", () => {
    const plugin: SourcePlugin = {
      ...sourcePlugin("test:invalid-options"),
      validate: () => err({ code: "plugin", message: "invalid options" }),
    };

    expect(resolvePlugin([plugin], { use: plugin.id }, "source")).toEqual({
      ok: false,
      error: { code: "plugin", message: "invalid options" },
    });
  });

  it("rejects malformed and thrown validation results", () => {
    const malformed: SourcePlugin = {
      ...sourcePlugin("test:malformed"),
      validate: () => ({ invalid: true }) as never,
    };
    const throwing: SourcePlugin = {
      ...sourcePlugin("test:throws"),
      validate: () => {
        throw new Error("reactor breach");
      },
    };

    expect(resolvePlugin([malformed], { use: malformed.id }, "source")).toMatchObject({
      ok: false,
      error: { message: "Invalid validation result from test:malformed" },
    });
    expect(resolvePlugin([throwing], { use: throwing.id }, "source")).toMatchObject({
      ok: false,
      error: { message: "reactor breach" },
    });
  });

  it("rejects unknown plugins and kind mismatches", () => {
    const plugin = sourcePlugin("test:source");

    expect(resolvePlugin([plugin], { use: "test:missing" }, "source")).toMatchObject({
      ok: false,
      error: { message: "Unknown plugin: test:missing" },
    });
    expect(resolvePlugin([plugin], { use: plugin.id }, "output")).toMatchObject({
      ok: false,
      error: { message: "Plugin test:source is source, expected output" },
    });
  });
});
