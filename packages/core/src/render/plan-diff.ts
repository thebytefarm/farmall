import { match } from "massaman/match";

import { contentBytes, contentDigest, textContent } from "../filesystem/file-content.ts";
import type { FileContent, Plan, PlanAction } from "../types.ts";

const diffLines = (prefix: string, content: FileContent): readonly string[] => {
  const text = textContent(content);
  if (text !== null) return text.split("\n").map((line) => `${prefix}${line}`);
  return [
    `${prefix}[binary ${contentBytes(content).byteLength} bytes sha256:${contentDigest(content)}]`,
  ];
};

const conflictBefore = (
  action: Extract<PlanAction, { readonly action: "conflict" }>,
): readonly string[] => {
  if (!("before" in action) || action.before === undefined) return [];
  return diffLines("-", action.before);
};

const conflictAfter = (
  action: Extract<PlanAction, { readonly action: "conflict" }>,
): readonly string[] => {
  if (!("after" in action) || action.after === undefined) return [];
  return diffLines("+", action.after);
};

const renderAction = (action: PlanAction): readonly string[] =>
  match(action)
    .with({ action: "create" }, ({ path, after }) => [
      "--- /dev/null",
      `+++ ${path}`,
      ...diffLines("+", after),
    ])
    .with({ action: "update" }, ({ path, before, after }) => [
      `--- ${path}`,
      `+++ ${path}`,
      ...diffLines("-", before),
      ...diffLines("+", after),
    ])
    .with({ action: "delete" }, ({ path, before }) => [
      `--- ${path}`,
      "+++ /dev/null",
      ...diffLines("-", before),
    ])
    .with({ action: "noop" }, () => [])
    .with({ action: "conflict" }, (conflict) => [
      `--- ${conflict.path}`,
      `+++ ${conflict.path}`,
      ...conflictBefore(conflict),
      ...conflictAfter(conflict),
      `! ${conflict.reason}`,
    ])
    .exhaustive();

export const renderDiff = (plan: Plan): string => {
  const sections = plan.actions.flatMap(renderAction);
  if (sections.length === 0) return "No differences\n";
  return `${sections.join("\n")}\n`;
};
