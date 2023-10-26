import {
  generatePreviewableId,
  type ComponentAnalysis,
  type Story,
} from "@previewjs/analyzer-api";
import { parseSerializableValue } from "@previewjs/serializable-values";
import type { TypeResolver } from "@previewjs/type-analyzer";
import path from "path";
import ts from "typescript";
import { extractStoriesInfo } from "./extract-stories-info.js";
import { resolvePreviewableId } from "./resolve-component.js";

export async function extractCsf3Stories(
  rootDir: string,
  resolver: TypeResolver,
  sourceFile: ts.SourceFile,
  analyze: (id: string) => Promise<ComponentAnalysis>
): Promise<Story[]> {
  const storiesInfo = extractStoriesInfo(sourceFile);
  if (!storiesInfo) {
    return [];
  }

  const stories: Story[] = [];
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

      const associatedComponentId = resolvePreviewableId(
        rootDir,
        resolver.checker,
        storyComponent || storiesInfo.component || null
      );
      stories.push({
        id: generatePreviewableId({
          filePath: path.relative(rootDir, sourceFile.fileName),
          name,
        }),
        sourcePosition: {
          start: statement.getStart(),
          end: statement.getEnd(),
        },
        analyze: async () => ({
          args: args
            ? {
                sourcePosition: {
                  start: args.getStart(),
                  end: args.getEnd(),
                },
                value: await parseSerializableValue(args),
              }
            : null,
        }),
        associatedComponent: associatedComponentId
          ? {
              id: associatedComponentId,
              analyze: () => analyze(associatedComponentId),
            }
          : null,
      });
    }
  }

  return stories;
}
