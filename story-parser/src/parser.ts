import ts from "typescript";

export function parseStories(sourceCode: string): Stories {
  const sourceFile = ts.createSourceFile(
    __filename,
    sourceCode,
    ts.ScriptTarget.Latest,
    false /* setParentNodes */,
    ts.ScriptKind.TSX
  );
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      // export default ...

      if (ts.isObjectLiteralExpression(statement.expression)) {
        // { ... }

        const title = statement.expression.properties.find(
          (p) => p.name && ts.isIdentifier(p.name) && p.name.text === "title"
        );
        if (
          title &&
          ts.isPropertyAssignment(title) &&
          ts.isStringLiteral(title.initializer)
        ) {
          return {
            title: title.initializer.text,
          };
        }
      }
    }
    if (ts.isVariableStatement(statement)) {
      if (
        !statement.modifiers?.find(
          (m) => m.kind === ts.SyntaxKind.ExportKeyword
        )
      ) {
        continue;
      }
      // export const foo = ...
    }
  }
  return {};
}

export interface Stories {
  title?: string;
}
