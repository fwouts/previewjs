import ts from "typescript";

export function extractDefaultComponent(
  sourceFile: ts.SourceFile
): ts.Expression | null {
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      let exportedValue = statement.expression;
      while (ts.isAsExpression(exportedValue)) {
        exportedValue = exportedValue.expression;
      }
      if (ts.isObjectLiteralExpression(exportedValue)) {
        for (const property of exportedValue.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "component"
          ) {
            return property.initializer;
          }
        }
      }
    }
  }
  return null;
}
