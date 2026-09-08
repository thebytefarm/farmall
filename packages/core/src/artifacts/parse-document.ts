import { parseMarkdownFrontmatterContent } from "@sentry/dotagents-lib";

import { jsonObjectSchema } from "./json-value.ts";
import { err, errorMessage, ok, type Result } from "../result.ts";
import type { CoreError, JsonObject } from "../types.ts";

export interface ParsedDocument {
  readonly body: string;
  readonly metadata: JsonObject;
}

export const parseDocument = (path: string, content: string): Result<ParsedDocument, CoreError> => {
  if (!path.endsWith(".md") && !path.endsWith(".mdc")) {
    return ok({ body: content, metadata: {} });
  }
  if (!content.startsWith("---")) return ok({ body: content, metadata: {} });
  try {
    const document = parseMarkdownFrontmatterContent(content, path);
    const metadata = jsonObjectSchema.safeParse(document.meta);
    if (!metadata.success) {
      return err({ code: "source", message: "Frontmatter metadata must be JSON", path });
    }
    return ok({ body: document.body, metadata: metadata.data });
  } catch (error) {
    return err({ code: "source", message: errorMessage(error), path });
  }
};
