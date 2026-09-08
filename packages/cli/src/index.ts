#!/usr/bin/env node
import { createRequire } from "node:module";

import { cli } from "maltty";

import { commands } from "./commands/index.ts";

const packageMetadata = createRequire(import.meta.url)("../package.json") as Readonly<{
  version: string;
}>;

await cli({
  name: "farmall",
  version: packageMetadata.version,
  description: "Compile portable agent configuration into every tool you use",
  help: {
    header: "farmall: configurable agent artifacts in, native agent configuration out",
    footer: "Every source and output is a plugin. Nothing is tied to .farmall/.",
  },
  commands,
});
