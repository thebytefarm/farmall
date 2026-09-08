# @farmall/core

Composable source, transform, lint, output, planning, and apply primitives used by the Farmall CLI.

Artifact files and desired outputs accept text or exact `Uint8Array` content plus optional POSIX modes. Plugin contexts provide compatible text reads, byte reads, and single-read byte-plus-mode records. Planning, atomic apply, rollback, and crash recovery compare and persist exact bytes.

```bash
pnpm add @farmall/core
```

See the [plugin reference](https://github.com/thebytefarm/farmall/blob/main/docs/reference/plugins.md)
for contracts and examples.

Only the package root, `@farmall/core`, is public. Nested files under `dist/` are implementation
files required by the root module and are not supported package subpath exports.

## License

MIT (c) Zac Rosenbauer
