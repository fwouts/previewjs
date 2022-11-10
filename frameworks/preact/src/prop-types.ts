import ts from "typescript";

export function detectPropTypes(
  sourceFile: ts.SourceFile,
  name: string
): ts.Expression | null {
  for (const statement of sourceFile.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(statement.expression.left) &&
      ts.isIdentifier(statement.expression.left.expression)
    ) {
      const componentName = statement.expression.left.expression.text;
      if (componentName !== name) {
        continue;
      }

      if (
        ts.isFunctionDeclaration(statement.expression.right) ||
        ts.isFunctionExpression(statement.expression.right)
      ) {
        const componentFunction = statement.expression.right;
      }
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      const componentName = statement.name.text;
      if (componentName !== name) {
        continue;
      }
      for (const classMember of statement.members) {
        // Look for prop types members.
        if (
          ts.isPropertyDeclaration(classMember) &&
          classMember.initializer &&
          classMember.name.getText() === "propTypes"
        ) {
          return classMember.initializer;
        }
      }
    }
  }
  return null;
}
