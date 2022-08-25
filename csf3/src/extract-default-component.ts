import ts from "typescript";
import { resolveComponent } from "./resolve-component";

export function extractDefaultComponent(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile
): {
  absoluteFilePath: string;
  name: string;
} | null {
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      let exportedValue = statement.expression;
      if (ts.isAsExpression(exportedValue)) {
        exportedValue = exportedValue.expression;
      }
      if (ts.isObjectLiteralExpression(exportedValue)) {
        for (const property of exportedValue.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "component"
          ) {
            const defaultComponent =
              checker.getSymbolAtLocation(property.initializer) || null;
            if (defaultComponent) {
              return resolveComponent(checker, defaultComponent);
            } else {
              throw new Error(`Could not resolve default component`);
            }
          }
        }
      }
    }
  }
  return null;
}
