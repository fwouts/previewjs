import ts from "typescript";

export function detectExportedNames(
  sourceFile: ts.SourceFile
): Record<string, string> {
  const nameToExportedName: Record<string, string> = {};
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const specifier of statement.exportClause.elements) {
          const name = (specifier.propertyName || specifier.name).text;
          const exportedName = specifier.name.text;
          nameToExportedName[name] = exportedName;
        }
      }
      continue;
    }
    if (
      ts.isExportAssignment(statement) &&
      ts.isIdentifier(statement.expression)
    ) {
      const name = statement.expression.text;
      nameToExportedName[name] = "default";
      continue;
    }
    const hasExportModifier =
      statement.modifiers?.find(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      ) || false;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        const name = declaration.name.text;
        if (hasExportModifier) {
          nameToExportedName[name] = name;
        }
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      if (hasExportModifier) {
        nameToExportedName[name] = name;
      }
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      if (hasExportModifier) {
        nameToExportedName[name] = name;
      }
    }
  }
  return nameToExportedName;
}
