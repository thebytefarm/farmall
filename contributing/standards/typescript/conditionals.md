# Conditionals and branching

Keep branches flat and let TypeScript prove exhaustive domain handling.

## Use early returns for guards

Reject invalid state before the main path.

```ts
function processSkill(skill: Skill | null): Result<ProcessedSkill, SkillError> {
  if (!skill) return err({ type: "missing_skill" });
  if (!skill.enabled) return err({ type: "disabled_skill" });

  return processEnabledSkill(skill);
}
```

Avoid nested equivalents:

```ts
function processSkill(skill: Skill | null): Result<ProcessedSkill, SkillError> {
  if (skill) {
    if (skill.enabled) {
      return processEnabledSkill(skill);
    }
  }

  return err({ type: "invalid_skill" });
}
```

## Use `if` for simple conditions

Use `if`/`else` for booleans and short guard clauses. A ternary is acceptable only when both branches are short values and the expression reads more clearly than a helper function.

## Use exhaustive switches for variants

Farmall does not depend on a pattern-matching library. Use a `switch` plus a `never` assertion for closed discriminated unions.

```ts
function platformDirectory(platform: Platform): string {
  switch (platform) {
    case "claude-code":
      return ".claude";
    case "cursor":
      return ".cursor";
    case "codex":
      return ".codex";
    default:
      return assertNever(platform);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${String(value)}`);
}
```

The default branch must only assert an impossible state. Expected unsupported input belongs in a validated `Result` before this point.

## Match on domain data

Branch on the discriminant already present in the type. Do not add an intermediate category or cast inside a branch.

```ts
if (result.ok) {
  writePlan(result.value);
  return 0;
}

writeError(result.error);
return 1;
```

## References

- [Types](./types.md)
- [Errors](./errors.md)
