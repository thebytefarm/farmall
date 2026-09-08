import { describe, expect, it } from "vitest";

import type { Artifact, Emission } from "../artifacts/types.ts";
import { createPluginContext } from "../plugins/context.ts";
import type {
  FarmallPlugin,
  LintPlugin,
  OutputPlugin,
  SourcePlugin,
  TransformPlugin,
} from "../plugins/types.ts";
import { err, ok } from "../result.ts";
import { withTestFilesystem, writeTestFile } from "../test-filesystem.ts";
import { runLint, runOutputs, runSources, runTransforms } from "./run-stages.ts";

const artifact = (content: string): Artifact => ({
  type: "artifact",
  id: `rules:${content}`,
  kind: "rules",
  name: content,
  source: `${content}.md`,
  content,
  metadata: {},
  files: [{ path: `${content}.md`, content }],
});

const cyclicObject = (): Readonly<Record<string, unknown>> => {
  const value: Record<string, unknown> = {};
  Object.defineProperty(value, "self", { enumerable: true, value });
  return value;
};

const source = (id: string, content: string): SourcePlugin => ({
  apiVersion: 1,
  id,
  kind: "source",
  run: async () =>
    ok({
      value: [artifact(content)],
      diagnostics: [{ rule: id, severity: "info", message: id }],
    }),
});

const transform = (id: string, suffix: string): TransformPlugin => ({
  apiVersion: 1,
  id,
  kind: "transform",
  run: async (emissions) =>
    ok({
      value: emissions.map((emission) => {
        if (emission.type === "output") return emission;
        return { ...emission, content: `${emission.content}${suffix}` };
      }),
      diagnostics: [{ rule: id, severity: "info", message: id }],
    }),
});

const output = (id: string): OutputPlugin => ({
  apiVersion: 1,
  id,
  kind: "output",
  run: async (emissions) =>
    ok({
      value: [
        {
          path: `${id}.md`,
          content: emissions[0]!.id,
          output: id,
          plugin: id,
          sources: [emissions[0]!.id],
          writePolicy: "managed",
        },
      ],
      diagnostics: [{ rule: id, severity: "info", message: id }],
    }),
});

const lint = (id: string): LintPlugin => ({
  apiVersion: 1,
  id,
  kind: "lint",
  run: async () => ok([{ rule: id, severity: "info", message: id }]),
});

describe("run stages", () => {
  it("preserves source, transform, output, and lint ordering semantics", async () =>
    withTestFilesystem(async (root) => {
      const context = createPluginContext(root);
      const sources = await runSources(
        [{ use: "source:a" }, { use: "source:b" }],
        [source("source:a", "a"), source("source:b", "b")],
        context,
      );
      expect(sources.ok).toBe(true);
      if (!sources.ok) return;
      const transforms = await runTransforms(
        sources.value.value,
        [{ use: "transform:a" }, { use: "transform:b" }],
        [transform("transform:a", "1"), transform("transform:b", "2")],
        context,
      );
      expect(transforms.ok).toBe(true);
      if (!transforms.ok) return;
      const outputs = await runOutputs(
        transforms.value.value,
        [{ use: "output:a" }, { use: "output:b" }],
        [output("output:a"), output("output:b")],
        context,
      );
      const linted = await runLint(
        transforms.value.value,
        [{ use: "lint:a" }, { use: "lint:b" }],
        [lint("lint:a"), lint("lint:b")],
        context,
      );

      expect(
        transforms.value.value.map((emission) => {
          if (emission.type === "output") return emission.id;
          return emission.content;
        }),
      ).toEqual(["a12", "b12"]);
      expect(outputs.ok && outputs.value.value.map((file) => file.output)).toEqual([
        "output:a",
        "output:b",
      ]);
      expect(linted.ok && linted.value.map((diagnostic) => diagnostic.rule)).toEqual([
        "lint:a",
        "lint:b",
      ]);
    }));

  it("stops each stage on Result failures", async () =>
    withTestFilesystem(async (root) => {
      const context = createPluginContext(root);
      const failure = err({ code: "plugin" as const, message: "failed" });
      const sourceFailure: SourcePlugin = {
        ...source("source:error", "x"),
        run: async () => failure,
      };
      const transformFailure: TransformPlugin = {
        ...transform("transform:error", "x"),
        run: async () => failure,
      };
      const outputFailure: OutputPlugin = { ...output("output:error"), run: async () => failure };
      const lintFailure: LintPlugin = { ...lint("lint:error"), run: async () => failure };

      await expect(
        runSources([{ use: sourceFailure.id }], [sourceFailure], context),
      ).resolves.toEqual(failure);
      await expect(
        runTransforms(
          [artifact("x")],
          [{ use: transformFailure.id }, { use: "missing" }],
          [transformFailure],
          context,
        ),
      ).resolves.toEqual(failure);
      await expect(
        runOutputs([artifact("x")], [{ use: outputFailure.id }], [outputFailure], context),
      ).resolves.toEqual(failure);
      await expect(
        runLint([artifact("x")], [{ use: lintFailure.id }], [lintFailure], context),
      ).resolves.toEqual(failure);
    }));

  it("contains exceptions from every stage", async () =>
    withTestFilesystem(async (root) => {
      const context = createPluginContext(root);
      const throwingRun = async (): Promise<never> => {
        throw new Error("reactor breach");
      };
      const throwingStringRun = async (): Promise<never> => {
        throw "string breach";
      };
      const plugins: readonly FarmallPlugin[] = [
        { ...source("source:throws", "x"), run: throwingStringRun },
        { ...transform("transform:throws", "x"), run: throwingRun },
        { ...output("output:throws"), run: throwingRun },
        { ...lint("lint:throws"), run: throwingRun },
      ];
      const emissions: readonly Emission[] = [artifact("x")];

      const results = await Promise.all([
        runSources([{ use: "source:throws" }], plugins, context),
        runTransforms(emissions, [{ use: "transform:throws" }], plugins, context),
        runOutputs(emissions, [{ use: "output:throws" }], plugins, context),
        runLint(emissions, [{ use: "lint:throws" }], plugins, context),
      ]);

      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ok: false,
            error: expect.objectContaining({ code: "plugin" }),
          }),
        ]),
      );
      expect(results.every((result) => !result.ok)).toBe(true);
    }));

  it("returns resolution errors without invoking stages", async () =>
    withTestFilesystem(async (root) => {
      const context = createPluginContext(root);
      const emissions = [artifact("x")];

      await expect(runSources([{ use: "missing" }], [], context)).resolves.toMatchObject({
        ok: false,
      });
      await expect(
        runTransforms(emissions, [{ use: "missing" }], [], context),
      ).resolves.toMatchObject({ ok: false });
      await expect(runOutputs(emissions, [{ use: "missing" }], [], context)).resolves.toMatchObject(
        { ok: false },
      );
      await expect(runLint(emissions, [{ use: "missing" }], [], context)).resolves.toMatchObject({
        ok: false,
      });
    }));

  it("validates byte content and modes without corrupting typed arrays at plugin boundaries", async () =>
    withTestFilesystem(async (root) => {
      const bytes = new Uint8Array([0, 0xff, 65]);
      const emission: Emission = {
        type: "output",
        id: "output:binary",
        output: "binary",
        source: "binary",
        files: [{ path: "tool", content: bytes, mode: 0o755 }],
      };
      const mutatingTransform: TransformPlugin = {
        apiVersion: 1,
        id: "transform:bytes",
        kind: "transform",
        run: async (emissions) => {
          const direct = emissions[0];
          if (direct?.type !== "output") return ok({ value: emissions, diagnostics: [] });
          const content = direct.files[0]?.content;
          if (content instanceof Uint8Array) content[0] = 9;
          return ok({ value: emissions, diagnostics: [] });
        },
      };
      const validOutput: OutputPlugin = {
        ...output("output:bytes"),
        run: async () =>
          ok({
            value: [
              {
                path: "tool",
                content: bytes,
                mode: 0o755,
                output: "binary",
                plugin: "output:bytes",
                sources: ["output:binary"],
                writePolicy: "managed",
              },
            ],
            diagnostics: [],
          }),
      };
      const invalidOutput: OutputPlugin = {
        ...validOutput,
        id: "output:invalid-mode",
        run: async () =>
          ok({
            value: [
              {
                path: "tool",
                content: bytes,
                mode: 0o10_000,
                output: "binary",
                plugin: "output:invalid-mode",
                sources: ["output:binary"],
                writePolicy: "managed",
              },
            ],
            diagnostics: [],
          }),
      };
      const context = createPluginContext(root);

      const transformed = await runTransforms(
        [emission],
        [{ use: mutatingTransform.id }],
        [mutatingTransform],
        context,
      );
      const valid = await runOutputs([emission], [{ use: validOutput.id }], [validOutput], context);
      const invalid = await runOutputs(
        [emission],
        [{ use: invalidOutput.id }],
        [invalidOutput],
        context,
      );

      expect(transformed).toMatchObject({ ok: true });
      expect(bytes[0]).toBe(0);
      expect(valid).toMatchObject({ ok: true });
      expect(invalid).toMatchObject({ ok: false, error: { code: "plugin" } });
    }));

  it("clones and freezes accepted plugin results before returning them", async () =>
    withTestFilesystem(async (root) => {
      const bytes = new Uint8Array([1, 2, 3]);
      const metadata = { nested: { values: ["original"] } };
      const retained = {
        ...artifact("retained"),
        metadata,
        files: [{ path: "retained.bin", content: bytes }],
      } satisfies Artifact;
      const plugin: SourcePlugin = {
        ...source("source:retained", "unused"),
        run: async () => ok({ value: [retained], diagnostics: [] }),
      };

      const result = await runSources([{ use: plugin.id }], [plugin], createPluginContext(root));
      metadata.nested.values[0] = "mutated";
      bytes[0] = 9;

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const accepted = result.value.value[0];
      expect(accepted?.type).toBe("artifact");
      if (accepted?.type !== "artifact") return;
      expect(accepted.metadata).toEqual({ nested: { values: ["original"] } });
      expect(Object.isFrozen(accepted)).toBe(true);
      expect(Object.isFrozen(accepted.metadata.nested)).toBe(true);
      const acceptedContent = accepted.files[0]?.content;
      expect(acceptedContent).toEqual(new Uint8Array([1, 2, 3]));
      expect(acceptedContent).not.toBe(bytes);
      expect(Object.isFrozen(accepted.files)).toBe(true);
      expect(Object.isFrozen(acceptedContent)).toBe(false);
    }));

  it("copies SharedArrayBuffer-backed bytes at emission and result boundaries", async () =>
    withTestFilesystem(async (root) => {
      const inputShared = new SharedArrayBuffer(3);
      const outputShared = new SharedArrayBuffer(4);
      const inputBytes = new Uint8Array(inputShared);
      const outputBytes = new Uint8Array(outputShared);
      const emission: Emission = {
        type: "output",
        id: "output:shared-input",
        output: "shared-input",
        source: "shared-input",
        files: [{ path: "input.bin", content: inputBytes }],
      };
      const plugin: TransformPlugin = {
        ...transform("transform:shared", "unused"),
        run: async (emissions) => {
          const direct = emissions[0];
          expect(direct?.type).toBe("output");
          if (direct?.type !== "output") return ok({ value: emissions, diagnostics: [] });
          const received = direct.files[0]?.content;
          expect(received).toBeInstanceOf(Uint8Array);
          if (!(received instanceof Uint8Array)) return ok({ value: emissions, diagnostics: [] });
          expect(received).not.toBe(inputBytes);
          expect(received.buffer).not.toBe(inputShared);
          expect(received.buffer).toBeInstanceOf(ArrayBuffer);
          return ok({
            value: [
              {
                ...direct,
                files: [{ path: "output.bin", content: outputBytes }],
              },
            ],
            diagnostics: [],
          });
        },
      };

      const result = await runTransforms(
        [emission],
        [{ use: plugin.id }],
        [plugin],
        createPluginContext(root),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const accepted = result.value.value[0];
      expect(accepted?.type).toBe("output");
      if (accepted?.type !== "output") return;
      const content = accepted.files[0]?.content;
      expect(content).toBeInstanceOf(Uint8Array);
      if (!(content instanceof Uint8Array)) return;
      expect(content).not.toBe(outputBytes);
      expect(content.buffer).not.toBe(outputShared);
      expect(content.buffer).toBeInstanceOf(ArrayBuffer);
    }));

  it("prevents one plugin from poisoning context methods for the next", async () =>
    withTestFilesystem(async (root) => {
      await writeTestFile(root, "proof.txt", "original");
      const poisoning = {
        ...source("source:poison", "poison"),
        run: async (_options, context) => {
          Reflect.set(context, "read", async () => ok("poisoned"));
          return ok({ value: [artifact("poison")], diagnostics: [] });
        },
      } satisfies SourcePlugin;
      const observing = {
        ...source("source:observe", "observe"),
        run: async (_options, context) => {
          const content = await context.read("proof.txt");
          if (!content.ok) return content;
          return ok({ value: [artifact(content.value)], diagnostics: [] });
        },
      } satisfies SourcePlugin;

      const result = await runSources(
        [{ use: poisoning.id }, { use: observing.id }],
        [poisoning, observing],
        createPluginContext(root),
      );

      expect(result.ok && result.value.value.map(({ id }) => id)).toEqual([
        "rules:poison",
        "rules:original",
      ]);
    }));

  it.each([
    ["bigint", BigInt(1)],
    ["undefined", undefined],
    ["function", () => "nope"],
    ["symbol", Symbol("nope")],
    ["cycle", cyclicObject()],
    ["non-plain object", new Date(0)],
  ])("rejects hostile %s artifact metadata at the external boundary", async (_name, value) => {
    const invalid = { ...artifact("invalid"), metadata: { value } as Artifact["metadata"] };
    const plugin: SourcePlugin = {
      ...source("source:invalid", "unused"),
      run: async () => ok({ value: [invalid], diagnostics: [] }),
    };

    await expect(
      runSources([{ use: plugin.id }], [plugin], createPluginContext("/unused")),
    ).resolves.toMatchObject({ ok: false, error: { code: "plugin" } });
  });
});
