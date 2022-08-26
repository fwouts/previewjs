import ts from "typescript";

export function resolveComponent(
  checker: ts.TypeChecker,
  expression: ts.Expression
): {
  absoluteFilePath: string;
  name: string;
} | null {
  const symbol = checker.getSymbolAtLocation(expression);
  if (!symbol) {
    return null;
  }
  return resolveSymbol(checker, symbol);
}

function resolveSymbol(
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
  isDefault = false
): {
  absoluteFilePath: string;
  name: string;
} | null {
  const declarations = symbol.getDeclarations() || [];
  const importClause = declarations.find(ts.isImportClause);
  if (importClause) {
    // Default import.
    const imported = checker.getSymbolAtLocation(
      importClause.parent.moduleSpecifier
    );
    if (imported) {
      return resolveSymbol(checker, imported, true);
    }
  }
  const importSpecifier = declarations.find(ts.isImportSpecifier);
  if (importSpecifier) {
    // Named import.
    const imported = importSpecifier.propertyName
      ? checker.getSymbolAtLocation(importSpecifier.propertyName)
      : checker.getAliasedSymbol(symbol);
    if (imported) {
      return resolveSymbol(checker, imported);
    }
  }
  const exportSpecifier = declarations.find(ts.isExportSpecifier);
  if (exportSpecifier) {
    // Re-exported name.
    const exported = exportSpecifier.propertyName
      ? checker.getSymbolAtLocation(exportSpecifier.propertyName)
      : checker.getAliasedSymbol(symbol);
    if (exported) {
      return resolveSymbol(checker, exported);
    }
  }
  const firstDeclaration = declarations[0];
  if (!firstDeclaration) {
    return null;
  }
  const sourceFile = firstDeclaration.getSourceFile();
  return {
    absoluteFilePath: sourceFile.fileName,
    name: isDefault ? "default" : symbol.getName(),
  };
}
