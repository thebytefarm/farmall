import { checkCommand } from "./check.ts";
import { diffCommand } from "./diff.ts";
import { initCommand } from "./init.ts";
import { lintCommand } from "./lint.ts";
import { pullCommand } from "./pull.ts";
import { syncCommand } from "./sync.ts";

export { checkCommand, diffCommand, initCommand, lintCommand, pullCommand, syncCommand };

export const commands = {
  init: initCommand,
  pull: pullCommand,
  sync: syncCommand,
  lint: lintCommand,
  check: checkCommand,
  diff: diffCommand,
};
