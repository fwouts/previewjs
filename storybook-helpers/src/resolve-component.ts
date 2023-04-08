import { generateComponentId } from "@previewjs/api";
import path from "path";
import ts from "typescript";

export function resolveComponentId(
  rootDirPath: string,
  checker: ts.TypeChecker,
  expression: ts.Expression
): string | null {
  const symbol = checker.getSymbolAtLocation(expression);
  if (!symbol) {
    return null;
  }
  return resolveSymbolToComponentId(rootDirPath, checker, symbol);
}

function resolveSymbolToComponentId(
  rootDirPath: string,
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
  isDefault = false
): string | null {
  const declarations = symbol.getDeclarations() || [];
  const importClause = declarations.find(ts.isImportClause);
  if (importClause) {
    // Default import.
    const imported = checker.getSymbolAtLocation(
      importClause.parent.moduleSpecifier
    );
    if (imported) {
      return resolveSymbolToComponentId(rootDirPath, checker, imported, true);
    }
  }
  const importSpecifier = declarations.find(ts.isImportSpecifier);
  if (importSpecifier) {
    // Named import.
    const imported = importSpecifier.propertyName
      ? checker.getSymbolAtLocation(importSpecifier.propertyName)
      : checker.getAliasedSymbol(symbol);
    if (imported) {
      return resolveSymbolToComponentId(rootDirPath, checker, imported);
    }
  }
  const exportSpecifier = declarations.find(ts.isExportSpecifier);
  if (exportSpecifier) {
    // Re-exported name.
    const exported = exportSpecifier.propertyName
      ? checker.getSymbolAtLocation(exportSpecifier.propertyName)
      : checker.getAliasedSymbol(symbol);
    if (exported) {
      return resolveSymbolToComponentId(rootDirPath, checker, exported);
    }
  }
  const firstDeclaration = declarations[0];
  if (!firstDeclaration) {
    return null;
  }
  const sourceFile = firstDeclaration.getSourceFile();
  return generateComponentId({
    filePath: path.relative(rootDirPath, sourceFile.fileName),
    name: isDefault ? "default" : symbol.getName(),
  });
}
