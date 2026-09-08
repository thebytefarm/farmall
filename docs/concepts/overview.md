# How Farmall works

Farmall separates artifact discovery from output layout. The pipeline is explicit:

```text
sources -> transforms -> outputs -> lint -> plan
                                      |
                                      +-> sync or pull applies
                                      +-> check or diff stops
```

Sources append emissions in config order. Each transform receives the current emission set and replaces it with its result. Output plugins receive the transformed emissions and return desired files. Lint plugins inspect the same transformed emissions. Diagnostics from every stage are collected, adjusted by severity overrides, and sorted before the core creates a plan.

## Emissions

An `Artifact` is normalized content with a kind, stable ID, name, source path, parsed frontmatter metadata, and bundled files. A `DirectOutput` names one output and carries files that must stay native.

Sources may return either form. Transforms may change or filter both forms. Output plugins return `DesiredFile` records, not filesystem writes.

## Plans

The planner compares desired files with the working tree and ownership manifest. Each action is `create`, `update`, `delete`, `noop`, or `conflict`.

Managed files can be updated or removed only while their content still matches the digest Farmall recorded. Create-only files never enter the ownership manifest. An existing create-only destination is accepted only when its content is already identical.

Read [pipelines](./pipelines.md), [artifact layout](./artifacts.md), and [ownership and safety](./ownership-and-safety.md) for the full contracts.
