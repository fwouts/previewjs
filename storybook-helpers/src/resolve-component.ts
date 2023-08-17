import { generatePreviewableId } from "@previewjs/analyzer-api";
import path from "path";
import ts from "typescript";

export function resolvePreviewableId(
  rootDir: string,
  checker: ts.TypeChecker,
  expression: ts.Expression | null
): string | null {
  if (!expression) {
    return null;
  }
  const symbol = checker.getSymbolAtLocation(expression);
  if (!symbol) {
    return null;
  }
  return resolveSymbolToPreviewableId(rootDir, checker, symbol);
}

function resolveSymbolToPreviewableId(
  rootDir: string,
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
      return resolveSymbolToPreviewableId(rootDir, checker, imported, true);
    }
  }
  const importSpecifier = declarations.find(ts.isImportSpecifier);
  if (importSpecifier) {
    // Named import.
    const imported = importSpecifier.propertyName
      ? checker.getSymbolAtLocation(importSpecifier.propertyName)
      : checker.getAliasedSymbol(symbol);
    if (imported) {
      return resolveSymbolToPreviewableId(rootDir, checker, imported);
    }
  }
  const exportSpecifier = declarations.find(ts.isExportSpecifier);
  if (exportSpecifier) {
    // Re-exported name.
    const exported = exportSpecifier.propertyName
      ? checker.getSymbolAtLocation(exportSpecifier.propertyName)
      : checker.getAliasedSymbol(symbol);
    if (exported) {
      return resolveSymbolToPreviewableId(rootDir, checker, exported);
    }
  }
  const firstDeclaration = declarations[0];
  if (!firstDeclaration) {
    return null;
  }
  const sourceFile = firstDeclaration.getSourceFile();
  return generatePreviewableId({
    filePath: path.relative(rootDir, sourceFile.fileName),
    name: isDefault ? "default" : symbol.getName(),
  });
}
