#!/usr/bin/env node
import { cli } from "maltty";
import { report } from "maltty/report";
import { FARMALL_VERSION } from "@farmall/core";
import { commands } from "./commands/index.ts";

await cli({
  name: "farmall",
  version: FARMALL_VERSION,
  description:
    "One source of truth for all your AI coding agents — sync skills, rules, and subagents, then lint them for cross-platform support.",
  commands,
  middleware: [report()],
  help: {
    header: "farmall — farm all your agents.",
    footer: "Docs: https://github.com/thebytefarm/farmall/tree/main/docs",
    order: ["init", "pull", "sync", "lint", "check", "diff"],
  },
});
