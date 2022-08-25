import ts from "typescript";

export function resolveComponent(
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
  isDefault = false
): {
  absoluteFilePath: string;
  name: string;
} {
  const declarations = symbol.getDeclarations() || [];
  const importClause = declarations.find(ts.isImportClause);
  if (importClause) {
    // Default import.
    const imported = checker.getSymbolAtLocation(
      importClause.parent.moduleSpecifier
    );
    if (imported) {
      return resolveComponent(checker, imported, true);
    }
  }
  const importSpecifier = declarations.find(ts.isImportSpecifier);
  if (importSpecifier) {
    // Named import.
    const imported = importSpecifier.propertyName
      ? checker.getSymbolAtLocation(importSpecifier.propertyName)
      : checker.getAliasedSymbol(symbol);
    if (imported) {
      return resolveComponent(checker, imported);
    }
  }
  const exportSpecifier = declarations.find(ts.isExportSpecifier);
  if (exportSpecifier) {
    // Re-exported name.
    const exported = exportSpecifier.propertyName
      ? checker.getSymbolAtLocation(exportSpecifier.propertyName)
      : checker.getAliasedSymbol(symbol);
    if (exported) {
      return resolveComponent(checker, exported);
    }
  }
  const firstDeclaration = declarations[0];
  if (!firstDeclaration) {
    throw new Error(`No declaration found for symbol ${symbol.getName()}`);
  }
  const sourceFile = firstDeclaration.getSourceFile();
  return {
    absoluteFilePath: sourceFile.fileName,
    name: isDefault ? "default" : symbol.getName(),
  };
}
