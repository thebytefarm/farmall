import { defineConfig } from "ciderpress";

import pkg from "./packages/cli/package.json";

export default defineConfig({
  title: "farmall",
  description: "Compile shared agent configuration into platform-native files.",
  seo: {
    origin: "https://farmall.thebytefarm.dev",
    titleTemplate: "%s | farmall",
    openGraph: { siteName: "farmall", type: "website", locale: "en_US" },
    twitter: { card: "summary_large_image" },
    sitemap: true,
  },
  version: `v${pkg.version}`,
  theme: {
    themes: ["honeycrisp"],
  },
  editLink: { repo: "thebytefarm/farmall", branch: "main", directory: "docs" },
  reportLink: { repo: "thebytefarm/farmall" },
  feedback: true,
  topbar: {
    nav: [
      { title: "Start", link: "/getting-started/quick-start" },
      { title: "Concepts", link: "/concepts/overview" },
      { title: "Reference", link: "/reference/cli" },
    ],
    cta: { text: "Install and run", href: "/getting-started/quick-start" },
    socials: true,
  },
  sidebar: {
    top: [{ text: "Home", href: "/", icon: "pixelarticons:home" }],
    bottom: [
      {
        text: "GitHub",
        href: "https://github.com/thebytefarm/farmall",
        icon: "simple-icons:github",
      },
    ],
    promo: {
      title: "Inspect before writing",
      body: "Use check or diff to review the complete pipeline plan without changing the working tree.",
      cta: { text: "Read the safety model", href: "/concepts/ownership-and-safety" },
    },
  },
  home: {
    hero: {
      label: `v${pkg.version} | MIT`,
      tagline:
        "Keep shared agent artifacts together, then write only the mappings each tool supports.",
      actions: [
        { variant: "primary", text: "Quick start", href: "/getting-started/quick-start" },
        { variant: "secondary", text: "Platform matrix", href: "/concepts/platforms" },
      ],
      demo: {
        type: "terminal",
        windowTitle: "farmall check",
        command: "farmall check",
        lines: [
          { kind: "info", text: "CREATE   CLAUDE.md" },
          { kind: "info", text: "CREATE   .agents/skills/review/SKILL.md" },
          { kind: "cmt", text: "2 artifacts, 2 outputs, 0 diagnostics" },
        ],
      },
    },
    blocks: [
      {
        type: "features",
        label: "Pipeline model",
        title: "Configuration with visible boundaries",
        body: "Sources and outputs are explicit. Unsupported mappings stay unsupported.",
        columns: 4,
        items: [
          {
            title: "Configurable stages",
            description:
              "Compose sources, transforms, lint checks, and outputs in named pipelines.",
            icon: "pixelarticons:sliders",
            link: "/concepts/pipelines",
          },
          {
            title: "Native files",
            description:
              "Route lossless settings and other platform files through named direct outputs.",
            icon: "pixelarticons:file-multiple",
            link: "/concepts/artifacts",
          },
          {
            title: "Owned writes",
            description:
              "Update only recorded files whose content still matches the ownership digest.",
            icon: "pixelarticons:shield",
            link: "/concepts/ownership-and-safety",
          },
          {
            title: "Honest mappings",
            description: "Use an exact matrix for instructions, rules, skills, and subagents.",
            icon: "pixelarticons:list-box",
            link: "/concepts/platforms",
          },
        ],
      },
      {
        type: "split",
        label: "Configuration",
        title: "Name the pipeline and every stage",
        body: "Each command resolves the config root, loads plugins, and runs the selected pipeline. Severity overrides apply after all diagnostics are collected.",
        bullets: [
          "TS, JS, MJS, JSON, JSONC, YAML, and YML configs",
          "Explicit source and output options",
          "Rule-level error, warn, info, or off overrides",
        ],
        cta: {
          variant: "primary",
          text: "Configuration reference",
          href: "/reference/configuration",
        },
        visual: {
          type: "code",
          language: "js",
          code: `export default {
  pipelines: {
    default: {
      sources: [{ use: "farmall:source" }],
      lint: [{ use: "farmall:lint" }],
      outputs: [{ use: "farmall:claude-code" }],
    },
  },
};`,
        },
      },
      {
        type: "tabs",
        label: "Commands",
        title: "Use one plan for preview and apply",
        body: "The command changes what happens after planning, not how desired files are calculated.",
        orientation: "horizontal",
        items: [
          {
            label: "Check",
            icon: { id: "pixelarticons:check", color: "green" },
            title: "Report drift without writes",
            body: "Check prints diagnostics and actions, then exits with status 1 when changes are pending.",
            visual: {
              type: "terminal",
              command: "farmall check --pipeline default",
              lines: [{ kind: "cmt", text: "working tree unchanged" }],
            },
          },
          {
            label: "Diff",
            icon: { id: "pixelarticons:git-branch", color: "amber" },
            title: "Review exact content changes",
            body: "Diff renders creates, updates, deletes, and conflicts from the deterministic plan.",
            cta: { variant: "secondary", text: "CLI reference", href: "/reference/cli" },
          },
          {
            label: "Sync",
            icon: { id: "pixelarticons:reload", color: "blue" },
            title: "Verify, write, and record ownership",
            body: "Sync blocks on errors or conflicts, checks for stale destinations, writes each file atomically, and rolls back failures.",
            cta: {
              variant: "secondary",
              text: "Ownership and safety",
              href: "/concepts/ownership-and-safety",
            },
          },
          {
            label: "Pull",
            icon: { id: "pixelarticons:download", color: "purple" },
            title: "Import through a normal pipeline",
            body: "Pull defaults to the pull pipeline. The generated config reads Claude Code and writes normalized files with create-only policy.",
          },
        ],
      },
      {
        type: "cta",
        label: "First pass",
        title: "Initialize, inspect, then sync.",
        body: "Start with the generated config and change the pipeline when your repository needs different sources or outputs.",
        actions: [
          {
            variant: "primary",
            text: "Open the quick start",
            href: "/getting-started/quick-start",
          },
          { variant: "secondary", text: "Browse built-ins", href: "/reference/built-ins" },
        ],
      },
    ],
  },
  pages: [
    {
      title: "Getting started",
      description: "Install Farmall and run a first pipeline.",
      icon: "pixelarticons:speed-fast",
      path: "/getting-started",
      landing: true,
      pages: [
        {
          title: "Introduction",
          description: "The artifact, pipeline, and output model.",
          path: "/getting-started/introduction",
          include: "docs/getting-started/introduction.md",
        },
        {
          title: "Quick start",
          description: "Install, initialize, preview, sync, and pull.",
          path: "/getting-started/quick-start",
          include: "docs/getting-started/quick-start.md",
        },
      ],
    },
    {
      title: "Concepts",
      description: "How Farmall represents artifacts and controls writes.",
      icon: "pixelarticons:book-open",
      path: "/concepts",
      landing: true,
      pages: [
        {
          title: "Overview",
          description: "Pipeline stages, emissions, and plans.",
          path: "/concepts/overview",
          include: "docs/concepts/overview.md",
        },
        {
          title: "Pipelines",
          description: "Sources, transforms, lint, outputs, and severity overrides.",
          path: "/concepts/pipelines",
          include: "docs/concepts/pipelines.md",
        },
        {
          title: "Artifact layout",
          description: "Normalized artifacts and native direct outputs.",
          path: "/concepts/artifacts",
          include: "docs/concepts/artifacts.md",
        },
        {
          title: "Ownership and safety",
          description: "Conflicts, containment, stale plans, and rollback.",
          path: "/concepts/ownership-and-safety",
          include: "docs/concepts/ownership-and-safety.md",
        },
        {
          title: "Platform matrix",
          description: "Exact built-in paths and unsupported mappings.",
          path: "/concepts/platforms",
          include: "docs/concepts/platforms.md",
        },
      ],
    },
    {
      title: "Reference",
      description: "CLI, config, built-ins, and plugin contracts.",
      icon: "pixelarticons:list-box",
      path: "/reference",
      landing: true,
      pages: [
        {
          title: "CLI",
          description: "Commands, options, writes, and exit behavior.",
          path: "/reference/cli",
          include: "docs/reference/cli.md",
        },
        {
          title: "Configuration",
          description: "Discovery, formats, pipelines, and plugin uses.",
          path: "/reference/configuration",
          include: "docs/reference/configuration.md",
        },
        {
          title: "Built-ins",
          description: "Source, platform source, lint, filesystem, and platform outputs.",
          path: "/reference/built-ins",
          include: "docs/reference/built-ins.md",
        },
        {
          title: "Plugin authoring",
          description: "Exported types, Result helpers, stage helpers, and write boundaries.",
          path: "/reference/plugins",
          include: "docs/reference/plugins.md",
        },
      ],
    },
  ],
  socials: [
    { icon: "github", url: "https://github.com/thebytefarm/farmall" },
    { icon: "npm", url: "https://www.npmjs.com/package/farmall" },
  ],
  footer: {
    message: "One config root. Explicit outputs.",
    copyright: true,
    tagline: "part of thebytefarm",
    brandMark: "F",
    socials: true,
    columns: [
      {
        heading: "Docs",
        links: [
          { text: "Quick start", href: "/getting-started/quick-start" },
          { text: "Platform matrix", href: "/concepts/platforms" },
          { text: "CLI reference", href: "/reference/cli" },
        ],
      },
      {
        heading: "Project",
        links: [
          { text: "GitHub", href: "https://github.com/thebytefarm/farmall" },
          { text: "npm", href: "https://www.npmjs.com/package/farmall" },
          { text: "Issues", href: "https://github.com/thebytefarm/farmall/issues" },
        ],
      },
    ],
  },
});
