import { generateComponentId } from "@previewjs/api";
import type { Component, ComponentProps } from "@previewjs/core";
import { parseSerializableValue } from "@previewjs/serializable-values";
import type { TypeResolver } from "@previewjs/type-analyzer";
import path from "path";
import ts from "typescript";
import { extractStoriesInfo } from "./extract-stories-info";
import { resolveComponentId } from "./resolve-component";

export function extractCsf3Stories(
  rootDirPath: string,
  resolver: TypeResolver,
  sourceFile: ts.SourceFile,
  analyzeComponent: (componentId: string) => Promise<ComponentProps>
): Component[] {
  const storiesInfo = extractStoriesInfo(sourceFile);
  if (!storiesInfo) {
    return [];
  }

  const components: Component[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    if (
      !statement.modifiers?.find((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        continue;
      }
      if (
        !declaration.initializer ||
        !ts.isObjectLiteralExpression(declaration.initializer)
      ) {
        continue;
      }
      const name = declaration.name.text;
      let storyComponent: ts.Expression | undefined;
      let args: ts.Expression | undefined;
      for (const property of declaration.initializer.properties) {
        if (
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name)
        ) {
          const propertyName = property.name.text;
          if (propertyName === "component") {
            storyComponent = property.initializer;
          } else if (propertyName === "args") {
            args = property.initializer;
          }
        }
      }

      const associatedComponentId = resolveComponentId(
        rootDirPath,
        resolver.checker,
        storyComponent || storiesInfo.component || null
      );
      components.push({
        componentId: generateComponentId({
          filePath: path.relative(rootDirPath, sourceFile.fileName),
          name,
        }),
        offsets: [statement.getStart(), statement.getEnd()],
        kind: "story",
        args: args
          ? {
              start: args.getStart(),
              end: args.getEnd(),
              value: parseSerializableValue(args),
            }
          : null,
        associatedComponent: associatedComponentId
          ? {
              componentId: associatedComponentId,
              extractProps: () => analyzeComponent(associatedComponentId),
            }
          : null,
      });
    }
  }

  return components;
}
