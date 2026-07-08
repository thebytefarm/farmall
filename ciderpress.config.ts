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
    ],
    cta: { text: "Get started →", href: "/getting-started/quick-start" },
  },
  home: {
    hero: {
      label: "★ open source · WIP · MIT",
      tagline:
        "Sync skills, rules, and subagents across every AI coding agent — then lint them for cross-platform support.",
      actions: [
        { variant: "primary", text: "Introduction", href: "/getting-started/introduction" },
        { variant: "secondary", text: "Quick Start", href: "/getting-started/quick-start" },
      ],
    },
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
          description: "Install farmall and see the planned commands.",
          path: "/getting-started/quick-start",
          include: "docs/getting-started/quick-start.md",
        },
      ],
    },
    {
      title: "Concepts",
      description: "How farmall keeps your agents in sync.",
      icon: "pixelarticons:book-open",
      path: "/concepts",
      landing: true,
      pages: [
        {
          title: "Overview",
          description: "One source of truth, many agents — how sync and lint fit together.",
          path: "/concepts/overview",
          include: "docs/concepts/overview.md",
        },
      ],
    },
  ],
  socials: [
    { icon: "github", url: "https://github.com/thebytefarm/farmall" },
    { icon: "npm", url: "https://www.npmjs.com/package/farmall" },
  ],
  footer: {
    message: "Built with ciderpress",
    copyright: true,
    tagline: "part of thebytefarm",
    socials: true,
  },
});
