import ts from "typescript";

export function extractArgs(sourceFile: ts.SourceFile) {
  const args: Record<string, ts.Expression> = {};
  for (const statement of sourceFile.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(statement.expression.left) &&
      ts.isIdentifier(statement.expression.left.expression)
    ) {
      const name = statement.expression.left.expression.text;
      // We're looking specifically for assignments such as Button.args = {...}.
      // We can make each such prop optional in the component, since it already has a value.
      // See https://storybook.js.org/docs/react/writing-stories/args
      if (statement.expression.left.name.text === "args") {
        args[name] = statement.expression.right;
      }
    }
  }
  return args;
}
