import { command } from "maltty";
import { loadConfig, pendingActions, planSync, tally } from "@farmall/core";
import {
  assertPlatform,
  assertTarget,
  configOption,
  dryRunOption,
  platformOption,
  readArgs,
  renderActions,
  resolvePlatforms,
  resolveTargets,
  targetPositional,
} from "./_shared.ts";

export default command({
  description: "Project the source of truth out to every configured platform by symlink.",
  positionals: targetPositional,
  options: { ...platformOption, ...dryRunOption, ...configOption },
  handler: async (ctx) => {
    const args = readArgs(ctx);
    assertTarget(ctx, args.target);
    assertPlatform(ctx, args.platform);

    const { path, config } = loadConfig(args.config);
    const targets = resolveTargets(config, args.target);
    const platforms = resolvePlatforms(config, args.platform);
    const actions = planSync(targets, platforms);
    const pending = pendingActions(actions);
    const counts = tally(actions);

    ctx.log.intro(ctx.colors.cyan("farmall sync"));
    ctx.log.info(
      `${ctx.colors.dim("config")} ${path}  ${ctx.colors.dim("targets")} ${targets.join(", ")}`,
    );

    if (args.dryRun) {
      ctx.log.warn("Dry run — nothing will be written. This is an alias for `farmall check`.");
      renderActions(ctx, actions);
      ctx.report.summary({
        style: "inline",
        stats: [
          `${ctx.colors.green(`${counts.create} create`)}`,
          `${ctx.colors.yellow(`${counts.update} relink`)}`,
          `${counts.linked} current`,
          `${counts.unsupported} skipped`,
        ],
      });
      ctx.log.outro(
        pending.length === 0 ? "Already in sync." : `${pending.length} change(s) pending.`,
      );
      return;
    }

    if (pending.length === 0) {
      renderActions(ctx, actions);
      ctx.log.outro(ctx.colors.green("Already in sync — nothing to do."));
      return;
    }

    await ctx.status.tasks(
      pending.map((action) => ({
        title: `${action.artifact} → ${action.dest}`,
        task: async (message) => {
          message(`linking ${action.source}`);
          return `${action.status === "create" ? "created" : "relinked"} ${action.dest}`;
        },
      })),
    );

    ctx.report.summary({
      style: "tally",
      stats: [
        { label: "Created", value: ctx.colors.green(String(counts.create)) },
        { label: "Relinked", value: ctx.colors.yellow(String(counts.update)) },
        { label: "Current", value: String(counts.linked) },
        { label: "Skipped", value: ctx.colors.dim(String(counts.unsupported + counts.partial)) },
      ],
    });
    ctx.log.outro(
      ctx.colors.green(`Synced ${pending.length} link(s) across ${platforms.length} platform(s).`),
    );
  },
});
