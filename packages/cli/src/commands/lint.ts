import { command } from "maltty";
import type { Platform, Target } from "@farmall/core";
import { isPlatform, isTarget, loadConfig, PLATFORM_LABELS, runLint } from "@farmall/core";
import {
  assertPlatform,
  assertTarget,
  configOption,
  formatOption,
  platformOption,
  readArgs,
  resolveTargets,
  targetPositional,
} from "./_shared.ts";

export default command({
  description:
    "Check artifacts for cross-platform support. Exits non-zero on error-severity rules.",
  positionals: targetPositional,
  options: { ...platformOption, ...formatOption, ...configOption },
  handler: async (ctx) => {
    const args = readArgs(ctx);
    assertTarget(ctx, args.target);
    assertPlatform(ctx, args.platform);

    const { config } = loadConfig(args.config);
    const targets = resolveTargets(config, args.target);

    const opts: { target?: Target; platform?: Platform } = {};
    if (args.target && isTarget(args.target)) opts.target = args.target;
    if (args.platform && isPlatform(args.platform)) opts.platform = args.platform;
    const result = runLint(config, opts);

    if (args.format === "json") {
      ctx.log.raw(ctx.format.json(result));
      if (result.errors > 0) ctx.fail("lint failed", { exitCode: 1 });
      return;
    }

    ctx.log.intro(ctx.colors.cyan("farmall lint"));

    if (result.findings.length === 0) {
      ctx.log.success("No cross-platform issues found.");
      ctx.log.outro(ctx.colors.green("Everything triggers everywhere."));
      return;
    }

    for (const finding of result.findings) {
      ctx.report.finding({
        severity: finding.severity === "warn" ? "warning" : "error",
        rule: finding.rule,
        category: PLATFORM_LABELS[finding.platform],
        message: finding.message,
        help: finding.help,
        frame: {
          filePath: finding.path,
          startLine: finding.line,
          lines: [finding.snippet],
          annotation: {
            line: finding.line,
            column: finding.column,
            length: 8,
            message: `flagged for ${PLATFORM_LABELS[finding.platform]}`,
          },
        },
      });
    }

    ctx.report.summary({
      style: "inline",
      stats: [
        result.errors > 0
          ? ctx.colors.red(`${result.errors} error${result.errors === 1 ? "" : "s"}`)
          : "0 errors",
        ctx.colors.yellow(`${result.warnings} warning${result.warnings === 1 ? "" : "s"}`),
        `${targets.length} target(s)`,
      ],
    });

    if (result.errors > 0) {
      ctx.fail(`${result.errors} error-severity rule(s) failed.`, { exitCode: 1 });
    }
    ctx.log.outro(ctx.colors.yellow("Warnings only — sync will still work, but review the drift."));
  },
});
