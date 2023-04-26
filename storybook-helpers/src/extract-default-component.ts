import ts from "typescript";

export function extractDefaultComponent(
  sourceFile: ts.SourceFile
): ts.Expression | null {
  const entities: Record<string, ts.Expression> = {};
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          entities[declaration.name.text] = declaration.initializer;
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      return extractComponent(statement.expression);
    }
  }

  function extractComponent(expression: ts.Expression): ts.Expression | null {
    expression = unwrapExpression(expression);
    if (ts.isObjectLiteralExpression(expression)) {
      for (const property of expression.properties) {
        if (
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === "component"
        ) {
          return property.initializer;
        }
      }
    } else if (ts.isIdentifier(expression)) {
      const value = entities[expression.text];
      if (value) {
        return extractComponent(value);
      }
    }
    return null;
  }

  return null;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  while (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    expression = expression.expression;
  }
  return expression;
}
