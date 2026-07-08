#!/usr/bin/env node
import { parseArgs } from "node:util";

const VERSION = "0.0.1";

const SYNC_TARGETS = ["skills", "rules", "subagents", "agents"] as const;

const BANNER = "farmall — one source of truth for all your AI coding agents";

const HELP = `${BANNER}

  Status: WIP. Nothing here syncs yet — this is a placeholder release
  reserving the name while the real tool grows.

Usage
  farmall <command> [options]

Commands (planned)
  sync <${SYNC_TARGETS.join("|")}>   Sync agent config out to every platform
  lint                                Lint skills for cross-platform support

Options
  -v, --version                       Print version
  -h, --help                          Show this help
`;

const write = (stream: NodeJS.WriteStream, text: string): void => {
  stream.write(text.endsWith("\n") ? text : `${text}\n`);
};

const main = (argv: readonly string[]): number => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.version) {
    write(process.stdout, VERSION);
    return 0;
  }

  if (values.help || positionals.length === 0) {
    write(process.stdout, HELP);
    return 0;
  }

  write(process.stdout, `farmall is still WIP — "${positionals.join(" ")}" isn't wired up yet.`);
  return 0;
};

process.exit(main(process.argv.slice(2)));
