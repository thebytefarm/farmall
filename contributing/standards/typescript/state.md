# State management

Represent state with readonly arrays and objects. Every transition returns a new value.

## Never use Set or Map

Do not use `Set`, `Map`, `WeakSet`, or `WeakMap`. Their mutation-oriented APIs hide state changes and make value flow harder to follow.

Use these shapes instead:

```ts
type Skills = readonly Skill[];
type SkillsByName = Readonly<Record<string, Skill>>;
```

Use Massaman when converting, grouping, deduplicating, or updating collections:

```ts
import { keyBy, uniqBy } from "massaman/array";
import { toMerged } from "massaman/object";

const uniqueSkills = uniqBy(skills, (skill) => skill.name);
const skillsByName = keyBy(uniqueSkills, (skill) => skill.name);
const nextConfig = toMerged(config, patch);
```

## Return new state

Never mutate arrays, objects, function arguments, or shared state.

```ts
function addSkill(skills: readonly Skill[], skill: Skill): readonly Skill[] {
  return [...skills, skill];
}

function updateSkill(
  skills: readonly Skill[],
  name: string,
  patch: Partial<Skill>,
): readonly Skill[] {
  return skills.map((skill) => (skill.name === name ? { ...skill, ...patch } : skill));
}

function removeSkill(skills: readonly Skill[], name: string): readonly Skill[] {
  return skills.filter((skill) => skill.name !== name);
}
```

## Pass state explicitly

Do not hide mutable collection state in factories, closures, module globals, or singleton caches. Pass the current array or object into a function and return the next value.

```ts
interface CacheState<T> {
  readonly values: Readonly<Record<string, T>>;
}

function setCached<T>(state: CacheState<T>, key: string, value: T): CacheState<T> {
  return {
    ...state,
    values: { ...state.values, [key]: value },
  };
}
```

## Derive instead of duplicating

Compute values from source state rather than storing counts, names, or indexes that can drift.

```ts
const skillCount = state.skills.length;
const skillNames = state.skills.map((skill) => skill.name);
```

## References

- [Utilities](./utilities.md)
- [Design patterns](./design-patterns.md)
- [Functions](./functions.md)
