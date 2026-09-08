# Error handling

Expected failures are values. Unexpected programmer errors may still throw.

## Use `Result`

Farmall defines a discriminated result in `@farmall/core`:

```ts
export type Result<T, E = string> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

Use `ok()` and `err()` instead of constructing result objects at call sites.

## Return expected failures

Parsing, validation, missing files, unsupported platforms, and sync conflicts are expected failures. Return a domain-specific error.

```ts
interface ConfigError {
  readonly type: "invalid_config" | "missing_config";
  readonly message: string;
}

function loadConfig(path: string): Result<FarmallConfig, ConfigError> {
  if (!existsSync(path)) {
    return err({ type: "missing_config", message: `No config at ${path}` });
  }

  return ok(readConfig(path));
}
```

## Narrow before reading

Check `result.ok` before accessing `value` or `error`. TypeScript narrows the union automatically.

```ts
const result = loadConfig(path);

if (!result.ok) {
  logError(result.error);
  return 1;
}

applyConfig(result.value);
return 0;
```

Do not cast around a result:

```ts
const config = (loadConfig(path) as { value: FarmallConfig }).value;
```

## Chain with early returns

Return the first failure instead of nesting control flow.

```ts
function buildSyncPlan(path: string): Result<SyncPlan, SyncError> {
  const configResult = loadConfig(path);
  if (!configResult.ok) return err(toSyncError(configResult.error));

  const sourceResult = loadSource(configResult.value);
  if (!sourceResult.ok) return sourceResult;

  return createPlan(configResult.value, sourceResult.value);
}
```

## Keep throwing at boundaries

- Catch filesystem and dependency exceptions at the boundary that can translate them into a useful domain error.
- Do not swallow programmer errors or turn every exception into `unknown`.
- A function returning `Result` must return `err()` for every expected failure path.
- Render errors and choose exit codes in `packages/cli`, not in core.

## References

- [Types](./types.md)
- [Conditionals](./conditionals.md)
