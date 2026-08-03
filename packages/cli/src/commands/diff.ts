import { command } from "maltty";
import { loadConfig, PLATFORM_LABELS, planSync } from "@farmall/core";
import {
  assertPlatform,
  assertTarget,
  configOption,
  platformOption,
  readArgs,
  resolvePlatforms,
  resolveTargets,
  targetPositional,
} from "./_shared.ts";

/** A faux unified-diff hunk for an out-of-sync artifact. */
const HUNK: readonly { readonly sign: "+" | "-" | " "; readonly text: string }[] = [
  { sign: " ", text: "---" },
  { sign: " ", text: "name: pr-review" },
  { sign: "-", text: "description: Review the diff." },
  { sign: "+", text: "description: Review the working diff for bugs and cleanups." },
  { sign: " ", text: "---" },
];

export default command({
  description: "Show drift between the source of truth and each agent's on-disk config.",
  positionals: targetPositional,
  options: { ...platformOption, ...configOption },
  handler: async (ctx) => {
    const args = readArgs(ctx);
    assertTarget(ctx, args.target);
    assertPlatform(ctx, args.platform);

    const { path, config } = loadConfig(args.config);
    const targets = resolveTargets(config, args.target);
    const platforms = resolvePlatforms(config, args.platform);
    const drifted = planSync(targets, platforms).filter((action) => action.status === "update");

    ctx.log.intro(ctx.colors.cyan("farmall diff"));
    ctx.log.info(`${ctx.colors.dim("config")} ${path}`);

    if (drifted.length === 0) {
      ctx.log.success("No drift — every link matches the source of truth.");
      ctx.log.outro(ctx.colors.green("Clean."));
      return;
    }

    for (const action of drifted) {
      ctx.log.newline();
      ctx.log.raw(
        `${ctx.colors.bold(`${PLATFORM_LABELS[action.platform]} · ${action.target}`)}  ${ctx.colors.dim(
          `${action.source} → ${action.dest}`,
        )}`,
      );
      for (const line of HUNK) {
        const rendered = `${line.sign} ${line.text}`;
        if (line.sign === "+") ctx.log.raw(ctx.colors.green(rendered));
        else if (line.sign === "-") ctx.log.raw(ctx.colors.red(rendered));
        else ctx.log.raw(ctx.colors.dim(rendered));
      }
    }

    ctx.log.newline();
    ctx.log.outro(
      ctx.colors.yellow(`${drifted.length} artifact(s) drifted. Run \`farmall sync\` to relink.`),
    );
  },
});
