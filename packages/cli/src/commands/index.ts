import type { Command } from "maltty";
import init from "./init.ts";
import pull from "./pull.ts";
import sync from "./sync.ts";
import lint from "./lint.ts";
import check from "./check.ts";
import diff from "./diff.ts";

/** The full farmall command surface, in help-display order. */
export const commands: Record<string, Command> = { init, pull, sync, lint, check, diff };
