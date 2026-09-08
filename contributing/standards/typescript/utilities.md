# Utilities

Use `massaman` for immutable collection transformations. Prefer arrays and objects over stateful collection data structures.

## Never use Set or Map

Do not use `Set`, `Map`, `WeakSet`, or `WeakMap`. This applies to exported data, local variables, caches, and closure state.

| Need                  | Use                               |
| --------------------- | --------------------------------- |
| Ordered collection    | `readonly T[]`                    |
| Unique collection     | `uniq()` from `massaman/array`    |
| Keyed lookup          | `Readonly<Record<string, T>>`     |
| Grouped lookup        | `groupBy()` from `massaman/array` |
| Lookup by item key    | `keyBy()` from `massaman/array`   |
| Object transformation | `massaman/object` helpers         |

```ts
import { groupBy, keyBy, uniq } from "massaman/array";

const uniquePlatforms = uniq(platforms);
const skillsByPlatform = groupBy(skills, (skill) => skill.platform);
const skillsByName = keyBy(skills, (skill) => skill.name);
```

Do not replace arrays or records with stateful collection objects, even for local deduplication or lookup.

## Return new arrays and objects

Every collection operation returns a new value. Never mutate an input or shared object.

```ts
import { omit, toMerged } from "massaman/object";

const nextConfig = toMerged(config, patch);
const publicConfig = omit(nextConfig, ["internal"]);
const nextSkills = [...skills, newSkill];
```

## Reach order

1. Use `massaman/array` or `massaman/object`.
2. Use a native non-mutating array or object operation.
3. Add a small local function when the behavior is domain-specific.
4. Propose another dependency only when neither Massaman nor the platform covers the behavior.

## Keep helpers local

Do not create a generic utility module for one call site. Keep a helper next to its caller until a second real use proves the abstraction.

## References

- [Functions](./functions.md)
- [State](./state.md)
- [Design patterns](./design-patterns.md)
