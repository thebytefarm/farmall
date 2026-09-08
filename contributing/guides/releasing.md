# Release packages

Farmall does not currently use Changesets or an automated publish workflow. Releases are manual,
and both public packages stay on the same version.

## Procedure

1. Update the version in `package.json`, `packages/core/package.json`, and
   `packages/cli/package.json`.
2. Run `pnpm install` so `pnpm-lock.yaml` records the package versions.
3. Run `pnpm validate` and `pnpm test:package-consumer`.
4. Run `pnpm pack:dry-run` and inspect both exact file lists for missing or stale output.
5. Publish `@farmall/core` first with `pnpm --filter @farmall/core publish --access public`.
6. After the core package is available from npm, publish `farmall` with
   `pnpm --filter farmall publish --access public`.

Do not publish the CLI first. Its packed `workspace:*` dependency is rewritten to the matching
`@farmall/core` version and must already be resolvable by consumers.

`maltty@1.0.0-rc.2` loads React and Ink from its root runtime. Farmall declares both packages
directly so consumers receive a complete executable installation. The isolated package-consumer
test runs `farmall --version` and `farmall --help` from the packed tarballs and blocks release if
that contract breaks.
