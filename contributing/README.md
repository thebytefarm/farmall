# Contributing

Welcome to the Farmall contributing docs. This directory contains standards and guides for working in this codebase.

## How to Use

- **Standards** define the rules -- read the relevant standard before writing code or docs.
- **Concepts** explain the "what" and "why" behind key architectural decisions.
- **Guides** are step-by-step walkthroughs for common tasks.

## Table of Contents

### Standards

#### TypeScript

- [Naming](./standards/typescript/naming.md) -- File, variable, and property naming conventions
- [Functions](./standards/typescript/functions.md) -- Object parameters, JSDoc, pure functions
- [Design Patterns](./standards/typescript/design-patterns.md) -- Functional patterns, factories, composition
- [Coding Style](./standards/typescript/coding-style.md) -- Formatting, naming conventions, code organization
- [State](./standards/typescript/state.md) -- Immutability, state encapsulation, data flow
- [Conditionals](./standards/typescript/conditionals.md) -- Guards and exhaustive branching
- [Types](./standards/typescript/types.md) -- Discriminated unions, branded types, type patterns
- [Errors](./standards/typescript/errors.md) -- Result type, error handling
- [Utilities](./standards/typescript/utilities.md) -- Native APIs and helper reach order
- [Testing](./standards/typescript/testing.md) -- Test structure, mocking, coverage

#### Git

- [Commits](./standards/git-commits.md) -- Commit message format and conventions
- [Pull Requests](./standards/git-pulls.md) -- PR creation, review, and merge process

#### Documentation

- [Writing](./standards/documentation/writing.md) -- Writing standards and templates
- [Formatting](./standards/documentation/formatting.md) -- Code examples, tables, markdown
- [Diagrams](./standards/documentation/diagrams.md) -- Mermaid diagram standards

### Concepts

- [Architecture](./concepts/architecture.md) -- Packages, plugin pipeline, Result boundary, and write planner
- [CLI](./concepts/cli.md) -- Maltty command modules, options, output, and exit behavior
- [Tech Stack](./concepts/tech-stack.md) -- Runtime, dependencies, tooling, and validation

### Guides

- [Getting Started](./guides/getting-started.md) -- Local setup and verification
- [Developing a Feature](./guides/developing-a-feature.md) -- Branch, code, test, PR, merge
- [Adding a CLI Command](./guides/adding-a-cli-command.md) -- End-to-end walkthrough for new commands
- [Releasing](./guides/releasing.md) -- Ordered manual package release procedure and blockers
