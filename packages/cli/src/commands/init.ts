import { command } from "maltty";
import type { Platform } from "@farmall/core";
import { isPlatform, PLATFORM_LABELS, PLATFORMS, SYNC_TARGETS } from "@farmall/core";
import { configOption, readArgs } from "./_shared.ts";

export default command({
  description: "Scaffold a source-of-truth directory and a farmall.config.ts in your repo.",
  options: {
    source: { type: "string", description: "Source directory to create.", default: ".farmall" },
    platforms: { type: "array", description: "Platforms to pre-populate in config." },
    ...configOption,
  },
  handler: async (ctx) => {
    const args = readArgs(ctx);
    ctx.log.intro(ctx.colors.cyan("farmall init"));

    const source =
      args.source ||
      (await ctx.prompts.text({
        message: "Where should the source of truth live?",
        placeholder: ".farmall",
        defaultValue: ".farmall",
      }));

    const preselected = (args.platforms ?? []).filter(isPlatform);
    const platforms =
      preselected.length > 0
        ? preselected
        : await ctx.prompts.multiselect<Platform>({
            message: "Which agents should farmall keep in sync?",
            options: PLATFORMS.map((platform) => ({
              value: platform,
              label: PLATFORM_LABELS[platform],
            })),
            initialValues: ["claude-code", "cursor", "codex"],
            required: true,
          });

    const proceed = await ctx.prompts.confirm({
      message: `Scaffold ${ctx.colors.cyan(source)}/ and farmall.config.ts for ${platforms.length} platform(s)?`,
      initialValue: true,
    });
    if (!proceed) {
      ctx.log.warn("Aborted — nothing written.");
      return;
    }

    await ctx.status.tasks([
      {
        title: `Create ${source}/`,
        task: async (message) => {
          for (const target of SYNC_TARGETS) {
            if (target === "instructions") continue;
            message(`mkdir ${source}/${target}`);
          }
          return `Created ${source}/ with ${SYNC_TARGETS.length - 1} target dirs`;
        },
      },
      {
        title: "Write farmall.config.ts",
        task: async () => "Wrote farmall.config.ts",
      },
      {
        title: "Seed AGENTS.md",
        task: async () => "Created AGENTS.md (instructions source)",
      },
    ]);

    ctx.log.box(
      [
        `platforms  ${platforms.map((platform) => PLATFORM_LABELS[platform]).join(", ")}`,
        `source     ${source}/`,
        `config     farmall.config.ts`,
      ].join("\n"),
      "Scaffold complete",
    );

    ctx.log.outro(
      `Next: drop skills into ${ctx.colors.cyan(`${source}/skills`)} then run ${ctx.colors.cyan(
        "farmall sync",
      )}.`,
    );
  },
});
