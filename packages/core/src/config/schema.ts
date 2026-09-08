import { z } from "zod";

import type { FarmallConfig } from "../pipeline/types.ts";

const optionsSchema = z.record(z.string(), z.unknown());
const pluginUseSchema = z
  .object({
    use: z.string().min(1),
    name: z.string().min(1).optional(),
    options: optionsSchema.optional(),
  })
  .strict();

const pipelineSchema = z
  .object({
    sources: z.array(pluginUseSchema).min(1),
    transforms: z.array(pluginUseSchema).optional(),
    lint: z.array(pluginUseSchema).optional(),
    outputs: z.array(pluginUseSchema).min(1),
  })
  .strict();

export const farmallConfigSchema = z
  .object({
    state: z.string().min(1).optional(),
    plugins: z.array(z.string().min(1)).optional(),
    pipelines: z.record(z.string(), pipelineSchema),
    severity: z.record(z.string(), z.enum(["error", "warn", "info", "off"])).optional(),
  })
  .strict();

export const defineConfig = <T extends FarmallConfig>(config: T): T => config;
