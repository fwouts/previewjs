import ts from "typescript";

export function detectPropTypes(
  sourceFile: ts.SourceFile,
  name: string
): ts.Expression | null {
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const varDeclaration of statement.declarationList.declarations) {
        if (varDeclaration.name.getText() != name) continue;
        if (
          ts.isArrowFunction(varDeclaration.initializer) ||
          ts.isFunctionExpression(varDeclaration.initializer)
        ) {
          return (varDeclaration.initializer as ts.ArrowFunction).parameters[0]
            .initializer;
        }
      }
    } else if (ts.isFunctionDeclaration(statement)) {
      if (statement.name.getText() != name) continue;
      return statement.parameters[0].initializer;
    }
  }
  return null;
}
