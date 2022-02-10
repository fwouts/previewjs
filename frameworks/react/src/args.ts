import { extractArgs } from "@previewjs/core";
import ts from "typescript";

export function detectArgs(
  sourceFile: ts.SourceFile,
  name: string
): ts.Expression | null {
  return extractArgs(sourceFile)[name] || null;
}
