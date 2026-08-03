/**
 * Library entry — what `import { defineConfig } from "farmall"` resolves to.
 * The bin lives in `index.ts`; this file is the programmatic surface.
 */
export { defineConfig } from "@farmall/core";
export type {
  FarmallConfig,
  LintConfig,
  LintOverride,
  Platform,
  RuleId,
  Severity,
  SyncSpec,
  SyncSpecObject,
  Target,
} from "@farmall/core";
