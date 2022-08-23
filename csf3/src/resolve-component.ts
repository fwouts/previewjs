import ts from "typescript";

export function resolveComponent(
  checker: ts.TypeChecker,
  symbol: ts.Symbol
): {
  absoluteFilePath: string;
  name: string;
} {
  const declarations = symbol.getDeclarations() || [];
  const importSpecifier = declarations.find(ts.isImportSpecifier);
  if (importSpecifier) {
    // TODO: Alternative importSpecifier.parent.parent.parent.moduleSpecifier to get module path?
    const imported = importSpecifier.propertyName
      ? checker.getSymbolAtLocation(importSpecifier.propertyName)
      : checker.getAliasedSymbol(symbol);
    if (imported) {
      return resolveComponent(checker, imported);
    }
  }
  const exportSpecifier = declarations.find(ts.isExportSpecifier);
  if (exportSpecifier) {
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
    name: symbol.getName(),
  };
}
