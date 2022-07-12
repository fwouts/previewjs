import type { Component } from "@previewjs/core";
import { EMPTY_OBJECT_TYPE } from "@previewjs/type-analyzer";
import ts from "typescript";

export function extractCsf3Stories(
  absoluteFilePath: string,
  sourceFile: ts.SourceFile
): Component[] {
  const components: Component[] = [];

  // Detect if we're dealing with a CSF3 module.
  // In particular, does it have a default export with a "component" property?

  let isCsf3Module = false;
  checkCsf3Module: for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      let exportedValue = statement.expression;
      if (ts.isAsExpression(exportedValue)) {
        exportedValue = exportedValue.expression;
      }
      if (ts.isObjectLiteralExpression(exportedValue)) {
        for (const property of exportedValue.properties) {
          if (
            property.name &&
            ts.isIdentifier(property.name) &&
            property.name.text === "component"
          ) {
            // Yes it is!
            isCsf3Module = true;
            break checkCsf3Module;
          }
        }
      }
    }
  }
  if (!isCsf3Module) {
    return [];
  }

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
      const argKeys = new Set<string>();
      for (const property of declaration.initializer.properties) {
        if (!property.name || !ts.isIdentifier(property.name)) {
          continue;
        }
        argKeys.add(property.name.text);
      }

      components.push({
        absoluteFilePath,
        name,
        exported: true,
        offsets: [[statement.getStart(), statement.getEnd()]],
        analyze: async () => {
          return {
            propsType: EMPTY_OBJECT_TYPE,
            providedArgs: argKeys,
            types: {},
          };
        },
      });
    }
  }

  return components;
}
