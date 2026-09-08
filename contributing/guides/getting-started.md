# Get started contributing

Set up a local Farmall checkout and run the same validation used before review.

## Prerequisites

- [Node.js](https://nodejs.org/) 26 or newer
- [pnpm](https://pnpm.io/) 12.3.4
- [Git](https://git-scm.com/)

## Setup

### 1. Fork and clone

```bash
gh repo fork thebytefarm/farmall --clone
cd farmall
```

### 2. Install dependencies

```bash
node --version
pnpm --version
pnpm install
```

The repository requires Node.js 26 or newer and declares `pnpm@12.3.4` in `package.json`.

### 3. Validate the checkout

```bash
pnpm validate
pnpm docs:check
```

### 4. Read the project docs

1. [`README.md`](../../README.md) for the product and workspace commands
2. [Architecture](../concepts/architecture.md) for package boundaries
3. [CLI](../concepts/cli.md) for command modules, options, and status codes
4. Relevant standards under [`contributing/standards/`](../standards/)

## Development

Run the CLI directly while working:

```bash
pnpm --filter farmall dev -- --help
pnpm --filter farmall dev -- check
```

The CLI test script builds core and CLI before integration tests execute `packages/cli/dist/index.js`:

```bash
pnpm --filter farmall test
```

Run the docs site locally:

```bash
pnpm docs:dev
```

## Troubleshooting

### pnpm is unavailable

Install pnpm 12.3.4, then verify the selected executable:

```bash
pnpm --version
```

### The lockfile is stale

Install dependencies from the repository root:

```bash
pnpm install
```

## References

- [Develop a feature](./developing-a-feature.md)
- [Release packages](./releasing.md)
- [Architecture](../concepts/architecture.md)
- [Tech stack](../concepts/tech-stack.md)
