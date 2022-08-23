import type { Component } from "@previewjs/core";
import ts from "typescript";
import { extractDefaultComponent } from "./extract-default-component";
import { resolveComponent } from "./resolve-component";

export function extractCsf3Stories(
  checker: ts.TypeChecker,
  absoluteFilePath: string,
  sourceFile: ts.SourceFile
): Component[] {
  // Detect if we're dealing with a CSF3 module.
  // In particular, does it have a default export with a "component" property?
  const defaultComponent = extractDefaultComponent(checker, sourceFile);
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
      let storyComponent: ts.Symbol | undefined;
      for (const property of declaration.initializer.properties) {
        if (
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === "component"
        ) {
          // Yes it is CSF3!
          storyComponent = checker.getSymbolAtLocation(property.initializer);
          break;
        }
      }

      components.push({
        absoluteFilePath,
        name,
        offsets: [[statement.getStart(), statement.getEnd()]],
        info: {
          kind: "story",
          associatedComponent: storyComponent
            ? resolveComponent(checker, storyComponent)
            : defaultComponent,
        },
      });
    }
  }

  return components;
}
