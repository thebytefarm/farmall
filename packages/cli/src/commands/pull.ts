import { command } from "maltty";
import type { Platform, Target } from "@farmall/core";
import { loadConfig, PLATFORM_LABELS } from "@farmall/core";
import {
  assertPlatform,
  assertTarget,
  configOption,
  dryRunOption,
  platformOption,
  readArgs,
  resolvePlatforms,
  resolveTargets,
  targetPositional,
} from "./_shared.ts";

/** Faux "already on disk" per-agent config that pull would consolidate. */
interface Discovered {
  readonly platform: Platform;
  readonly target: Target;
  readonly from: string;
  readonly into: string;
}

const DISCOVERED: readonly Discovered[] = [
  { platform: "claude-code", target: "instructions", from: "CLAUDE.md", into: "AGENTS.md" },
  {
    platform: "claude-code",
    target: "skills",
    from: ".claude/skills/pr-review/",
    into: ".farmall/skills/pr-review/",
  },
  {
    platform: "claude-code",
    target: "subagents",
    from: ".claude/agents/test-runner.md",
    into: ".farmall/subagents/test-runner.md",
  },
  {
    platform: "cursor",
    target: "rules",
    from: ".cursor/rules/typescript-style.mdc",
    into: ".farmall/rules/typescript-style.md",
  },
  {
    platform: "codex",
    target: "instructions",
    from: "AGENTS.md",
    into: "AGENTS.md",
  },
];

export default command({
  description: "Import existing per-agent config into the source of truth.",
  positionals: targetPositional,
  options: { ...platformOption, ...dryRunOption, ...configOption },
  handler: async (ctx) => {
    const args = readArgs(ctx);
    assertTarget(ctx, args.target);
    assertPlatform(ctx, args.platform);

    const { config } = loadConfig(args.config);
    const targets = new Set(resolveTargets(config, args.target));
    const platforms = new Set(resolvePlatforms(config, args.platform));
    const found = DISCOVERED.filter(
      (item) => targets.has(item.target) && platforms.has(item.platform),
    );

    ctx.log.intro(ctx.colors.cyan("farmall pull"));

    if (found.length === 0) {
      ctx.log.info("Nothing to import for the selected targets/platforms.");
      ctx.log.outro(ctx.colors.dim("Source of truth already owns everything."));
      return;
    }

    if (args.dryRun) {
      ctx.log.warn("Dry run — showing what would be imported.");
      for (const item of found) {
        ctx.report.check({
          status: "skip",
          name: `${item.from} → ${item.into}`,
          detail: PLATFORM_LABELS[item.platform],
          hint: item.target,
        });
      }
      ctx.log.outro(`${found.length} file(s) would be consolidated.`);
      return;
    }

    await ctx.status.tasks(
      found.map((item) => ({
        title: `${PLATFORM_LABELS[item.platform]}: ${item.target}`,
        task: async (message) => {
          message(`reading ${item.from}`);
          return `imported → ${item.into}`;
        },
      })),
    );

    ctx.report.summary({
      style: "inline",
      stats: [
        ctx.colors.green(`${found.length} imported`),
        `${platforms.size} platform(s)`,
        `${targets.size} target(s)`,
      ],
    });
    ctx.log.outro(
      `Consolidated into the source of truth. Review, then run ${ctx.colors.cyan("farmall sync")}.`,
    );
  },
});
