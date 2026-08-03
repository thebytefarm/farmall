import { command } from "maltty";
import { loadConfig, pendingActions, planSync, runLint, tally } from "@farmall/core";
import {
  assertPlatform,
  assertTarget,
  configOption,
  platformOption,
  readArgs,
  renderActions,
  resolvePlatforms,
  resolveTargets,
  targetPositional,
} from "./_shared.ts";

export default command({
  description: "Dry-run. Report what sync would change, what's out of sync, and what's broken.",
  positionals: targetPositional,
  options: { ...platformOption, ...configOption },
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
    const lint = runLint(config);

    ctx.log.intro(ctx.colors.cyan("farmall check"));
    ctx.log.info(`${ctx.colors.dim("config")} ${path}  ${ctx.colors.dim("read-only")}`);

    renderActions(ctx, actions);

    ctx.report.summary({
      style: "tally",
      stats: [
        { label: "Would create", value: ctx.colors.green(String(counts.create)) },
        { label: "Would relink", value: ctx.colors.yellow(String(counts.update)) },
        { label: "In sync", value: String(counts.linked) },
        { label: "Unsupported", value: ctx.colors.dim(String(counts.unsupported)) },
        {
          label: "Lint errors",
          value: lint.errors > 0 ? ctx.colors.red(String(lint.errors)) : "0",
        },
      ],
    });

    const problems = pending.length > 0 || lint.errors > 0;
    ctx.log.outro(
      problems
        ? ctx.colors.yellow(
            `${pending.length} change(s) pending, ${lint.errors} lint error(s). Run \`farmall sync\`.`,
          )
        : ctx.colors.green("Up to date and lint-clean."),
    );
  },
});
