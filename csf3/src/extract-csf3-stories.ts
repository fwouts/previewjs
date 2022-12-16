import type { Component, ComponentAnalysis } from "@previewjs/core";
import { parseSerializableValue } from "@previewjs/serializable-values";
import type { TypeResolver } from "@previewjs/type-analyzer";
import ts from "typescript";
import { extractDefaultComponent } from "./extract-default-component";
import { resolveComponent } from "./resolve-component";

export function extractCsf3Stories(
  resolver: TypeResolver,
  sourceFile: ts.SourceFile,
  analyzeComponent: (component: {
    absoluteFilePath: string;
    name: string;
  }) => Promise<ComponentAnalysis>
): Component[] {
  // Detect if we're dealing with a CSF3 module.
  // In particular, does it have a default export with a "component" property?
  const defaultComponent = extractDefaultComponent(sourceFile);
  if (!defaultComponent) {
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

      const associatedComponent = resolveComponent(
        resolver.checker,
        storyComponent || defaultComponent
      );
      components.push({
        absoluteFilePath: sourceFile.fileName,
        name,
        offsets: [[statement.getStart(), statement.getEnd()]],
        info: {
          kind: "story",
          args: args
            ? {
                start: args.getStart(),
                end: args.getEnd(),
                value: parseSerializableValue(args),
              }
            : null,
          associatedComponent: associatedComponent
            ? {
                ...associatedComponent,
                analyze: () => analyzeComponent(associatedComponent),
              }
            : null,
        },
      });
    }
  }

  return components;
}
