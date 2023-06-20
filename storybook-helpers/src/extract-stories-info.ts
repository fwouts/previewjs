import ts from "typescript";

export type StoriesInfo = {
  component: ts.Expression | null;
  title: string | null;
};

export function extractStoriesInfo(
  sourceFile: ts.SourceFile
): StoriesInfo | null {
  const entities: Record<string, ts.Expression> = {};
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          entities[declaration.name.text] = declaration.initializer;
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      return extractFromDefaultExport(statement.expression);
    }
  }

  function extractFromDefaultExport(
    expression: ts.Expression
  ): StoriesInfo | null {
    expression = unwrapExpression(expression);
    if (ts.isObjectLiteralExpression(expression)) {
      let component: ts.Expression | null = null;
      let title: string | null = null;
      for (const property of expression.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          !ts.isIdentifier(property.name)
        ) {
          continue;
        }
        if (property.name.text === "component") {
          component = property.initializer;
        } else if (
          property.name.text === "title" &&
          ts.isStringLiteral(property.initializer)
        ) {
          title = property.initializer.text;
        }
      }
      if (component || title) {
        return {
          component,
          title,
        };
      }
    } else if (ts.isIdentifier(expression)) {
      const value = entities[expression.text];
      if (value) {
        return extractFromDefaultExport(value);
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
