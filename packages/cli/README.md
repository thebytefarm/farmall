# farmall

Command-line interface for compiling portable agent artifacts into platform-native files.

## Install

```bash
npm install --global farmall
```

Version `0.0.2` implements `init`, `pull`, `sync`, `lint`, `check`, and `diff`.

## Quick use

```bash
farmall init
farmall check
farmall sync
```

The generated config reads normalized files from `agent-config/`, lints skills, and writes supported artifacts to Claude Code, Cursor, Codex, Copilot, opencode, Windsurf, Devin, and pi paths. Unsupported artifact kinds produce diagnostics and no output for that mapping.

Use `agent-config/outputs/<output>/...` for native files such as settings JSON, executables, or binary assets. Farmall copies exact bytes and POSIX permission modes to the output with the matching name. It does not translate settings between platforms. JSON output represents byte bodies as `{ "encoding": "base64", "data": "..." }`; terminal diffs show binary byte counts and SHA-256 digests instead of decoded content.

## Commands

| Command                   | Behavior                                                                          |
| ------------------------- | --------------------------------------------------------------------------------- |
| `farmall init [--json]`   | Create `farmall.config.mjs` and `agent-config/README.md` with create-only writes. |
| `farmall pull [options]`  | Run the `pull` pipeline by default and apply its import plan.                     |
| `farmall sync [options]`  | Run and apply the selected pipeline.                                              |
| `farmall lint [options]`  | Run configured stages and fail on error diagnostics without applying the plan.    |
| `farmall check [options]` | Report diagnostics, actions, conflicts, and drift without writing.                |
| `farmall diff [options]`  | Print deterministic file differences without writing.                             |

`pull`, `sync`, `lint`, `check`, and `diff` accept `--config <path>`, `--pipeline <name>`, and `--json`. The default pipeline is `default`, except `pull`, which defaults to `pull`.

Full documentation is in the repository [docs](https://github.com/thebytefarm/farmall/tree/main/docs).

## License

MIT © Zac Rosenbauer
