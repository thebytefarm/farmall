import { defineConfig } from "ciderpress";

export default defineConfig({
  title: "farmall",
  description: "One source of truth for all your AI coding agents.",
  version: "v0.0.1",
  theme: {
    themes: ["honeycrisp"],
  },
  editLink: { repo: "thebytefarm/farmall", branch: "main", directory: "docs" },
  reportLink: { repo: "thebytefarm/farmall" },
  topbar: {
    nav: [
      { title: "Getting Started", link: "/getting-started/introduction" },
      { title: "Concepts", link: "/concepts/overview" },
      { title: "Guides", link: "/guides/adopt-into-a-repo" },
      { title: "Reference", link: "/reference/cli" },
    ],
    cta: { text: "Get started →", href: "/getting-started/quick-start" },
  },
  home: {
    hero: {
      label: "★ open source · WIP · MIT",
      tagline:
        "Define your instructions, rules, skills, and subagents once. Sync them to every AI coding agent by symlink — then lint them for cross-platform support.",
      actions: [
        { variant: "primary", text: "Quick Start", href: "/getting-started/quick-start" },
        { variant: "secondary", text: "Introduction", href: "/getting-started/introduction" },
      ],
    },
    proof: { lead: "Built on", names: ["dotagents", "AGENTS.md", "SKILL.md"] },
    features: {
      columns: 3,
      items: [
        {
          title: "Define Once",
          description:
            "One source-of-truth directory. Author AGENTS.md, rules, skills, and subagents a single time — never per agent.",
          icon: "pixelarticons:folder",
        },
        {
          title: "Sync by Symlink",
          description:
            "Project the source into each agent's expected path with symlinks. One physical file, zero copies to drift.",
          icon: "pixelarticons:git-branch",
        },
        {
          title: "Lint for Support",
          description:
            "The reason this exists. Check whether one file actually behaves on every agent it's linked into.",
          icon: "pixelarticons:check-double",
        },
        {
          title: "Instructions vs Rules",
          description:
            "Portable AGENTS.md memory and scoped frontmatter rules are different things. farmall treats them that way.",
          icon: "pixelarticons:book-open",
        },
        {
          title: "Seven Agents, Deeply",
          description:
            "Claude Code, Cursor, Codex, Copilot, opencode, Devin, and pi — covered well, not a 40-agent race.",
          icon: "pixelarticons:users",
        },
        {
          title: "Adopt, Don't Rewrite",
          description:
            "farmall pull consolidates your existing .claude, .cursor, and AGENTS.md into the source of truth.",
          icon: "pixelarticons:download",
        },
      ],
    },
    layout: ["hero", "proof", "features", "cta"],
    cta: {
      title: "Sync gets it there. Lint tells you whether it will behave.",
      subtitle:
        "Define your agent config once, project it everywhere, and catch the drift before your teammate on a different agent does.",
      actions: [
        { variant: "primary", text: "Read the Overview", href: "/concepts/overview" },
        { variant: "secondary", text: "See the Support Matrix", href: "/reference/support-matrix" },
      ],
    },
  },
  sidebar: {
    promo: {
      title: "New: farmall",
      body: "One source of truth for all your AI coding agents. Sync by symlink, then lint for cross-platform support.",
      cta: { text: "Quick Start", href: "/getting-started/quick-start" },
    },
    bottom: [{ text: "Contributing", href: "/contributing", icon: "pixelarticons:git-merge" }],
  },
  pages: [
    {
      title: "Getting Started",
      description: "Install farmall and understand what it does.",
      icon: "pixelarticons:speed-fast",
      path: "/getting-started",
      landing: true,
      pages: [
        {
          title: "Introduction",
          description: "What farmall is, why it exists, and the gap it fills.",
          path: "/getting-started/introduction",
          include: "docs/getting-started/introduction.md",
        },
        {
          title: "Quick Start",
          description: "Install farmall and see the planned flow.",
          path: "/getting-started/quick-start",
          include: "docs/getting-started/quick-start.md",
        },
      ],
    },
    {
      title: "Concepts",
      description: "How farmall keeps your agents in sync — and honest.",
      icon: "pixelarticons:lightbulb",
      path: "/concepts",
      landing: true,
      pages: [
        {
          title: "Overview",
          description: "One source of truth, many agents — how sync and lint fit together.",
          path: "/concepts/overview",
          include: "docs/concepts/overview.md",
        },
        {
          title: "Define Once",
          description: "The source-of-truth directory and why there's only one physical file.",
          path: "/concepts/define-once",
          include: "docs/concepts/define-once.md",
        },
        {
          title: "Targets",
          description: "The five artifacts farmall syncs — and the instructions-vs-rules split.",
          path: "/concepts/targets",
          include: "docs/concepts/targets.md",
        },
        {
          title: "Configuration",
          description: "farmall.config.ts — the grammar that declares what syncs and how.",
          path: "/concepts/configuration",
          include: "docs/concepts/configuration.md",
        },
        {
          title: "Sync",
          description: "Symlink-based projection into each agent's config location.",
          path: "/concepts/sync",
          include: "docs/concepts/sync.md",
        },
        {
          title: "Lint",
          description: "The differentiator — checking that one file behaves on every agent.",
          path: "/concepts/lint",
          include: "docs/concepts/lint.md",
        },
        {
          title: "Platforms",
          description: "The seven supported agents and where each artifact lands.",
          path: "/concepts/platforms",
          include: "docs/concepts/platforms.md",
        },
      ],
    },
    {
      title: "Guides",
      description: "Step-by-step walkthroughs for common tasks.",
      icon: "pixelarticons:book",
      path: "/guides",
      landing: true,
      pages: [
        {
          title: "Adopt into a Repo",
          description: "Bring farmall into a repo that already has scattered agent config.",
          path: "/guides/adopt-into-a-repo",
          include: "docs/guides/adopt-into-a-repo.md",
        },
        {
          title: "Sync Skills",
          description: "Author a skill once and project it to every agent.",
          path: "/guides/sync-skills",
          include: "docs/guides/sync-skills.md",
        },
        {
          title: "Sync Instructions and Rules",
          description: "The instructions-vs-rules split, in practice.",
          path: "/guides/sync-instructions-and-rules",
          include: "docs/guides/sync-instructions-and-rules.md",
        },
        {
          title: "Write a Portable Skill",
          description: "Lint-driven authoring: write, lint, fix, override.",
          path: "/guides/write-a-portable-skill",
          include: "docs/guides/write-a-portable-skill.md",
        },
        {
          title: "Configure the Support Matrix",
          description: "Platforms, per-target sync specs, and lint overrides.",
          path: "/guides/configure-the-support-matrix",
          include: "docs/guides/configure-the-support-matrix.md",
        },
        {
          title: "Check and Diff",
          description: "Safe dry-runs and drift visibility before you sync.",
          path: "/guides/check-and-diff",
          include: "docs/guides/check-and-diff.md",
        },
      ],
    },
    {
      title: "Reference",
      description: "The complete command surface, config type, and support matrix.",
      icon: "pixelarticons:file-alt",
      path: "/reference",
      landing: true,
      pages: [
        {
          title: "CLI",
          description: "Every farmall command, flag, and exit behavior.",
          path: "/reference/cli",
          include: "docs/reference/cli.md",
        },
        {
          title: "Config",
          description: "The full farmall.config.ts type and defaults.",
          path: "/reference/config",
          include: "docs/reference/config.md",
        },
        {
          title: "Lint Rules",
          description: "The rule catalog — what each rule checks and its default severity.",
          path: "/reference/lint-rules",
          include: "docs/reference/lint-rules.md",
        },
        {
          title: "Support Matrix",
          description: "The canonical target × platform mapping.",
          path: "/reference/support-matrix",
          include: "docs/reference/support-matrix.md",
        },
      ],
    },
    {
      title: "Contributing",
      description: "Work on farmall itself.",
      icon: "pixelarticons:git-merge",
      path: "/contributing",
      nav: { island: true },
      pages: [
        {
          title: "Getting Started",
          description: "Set up your local environment and the develop loop.",
          path: "/contributing/getting-started",
          include: "contributing/getting-started.md",
        },
        {
          title: "Concepts",
          path: "/contributing/concepts",
          pages: [
            {
              title: "Architecture",
              path: "/contributing/concepts/architecture",
              include: "contributing/concepts/architecture.md",
            },
            {
              title: "Tech Stack",
              path: "/contributing/concepts/tech-stack",
              include: "contributing/concepts/tech-stack.md",
            },
          ],
        },
        {
          title: "Guides",
          path: "/contributing/guides",
          pages: [
            {
              title: "Adding a CLI Command",
              path: "/contributing/guides/adding-a-cli-command",
              include: "contributing/guides/adding-a-cli-command.md",
            },
          ],
        },
      ],
    },
  ],
  workspaces: [
    {
      title: "Packages",
      icon: "pixelarticons:code",
      items: [
        {
          title: "farmall",
          description: "The CLI — init, pull, sync, lint, check, and diff.",
          path: "/reference/cli",
          icon: "pixelarticons:command",
          tags: ["cli", "tooling"],
        },
      ],
    },
  ],
  socials: [
    { icon: "github", url: "https://github.com/thebytefarm/farmall" },
    { icon: "npm", url: "https://www.npmjs.com/package/farmall" },
  ],
  footer: {
    message: "One source of truth for all your AI coding agents.",
    copyright: { company: "ByteFarm", year: 2026 },
    tagline: "part of thebytefarm",
    socials: true,
    columns: [
      {
        heading: "Docs",
        links: [
          { text: "Getting Started", href: "/getting-started/introduction" },
          { text: "Guides", href: "/guides/adopt-into-a-repo" },
          { text: "Reference", href: "/reference/cli" },
        ],
      },
      {
        heading: "Project",
        links: [
          { text: "GitHub", href: "https://github.com/thebytefarm/farmall" },
          { text: "npm", href: "https://www.npmjs.com/package/farmall" },
          { text: "Contributing", href: "/contributing" },
        ],
      },
      {
        heading: "ByteFarm",
        links: [{ text: "thebytefarm", href: "https://github.com/thebytefarm" }],
      },
    ],
  },
});
