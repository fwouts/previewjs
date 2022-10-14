import type { ComponentAnalysis } from "@previewjs/core";
import {
  CollectedTypes,
  objectType,
  TypeAnalyzer,
  ValueType,
} from "@previewjs/type-analyzer";
import ts from "typescript";

export function analyzeSvelteComponent(
  typeAnalyzer: TypeAnalyzer,
  filePath: string
): ComponentAnalysis {
  const resolver = typeAnalyzer.analyze([filePath]);
  const sourceFile = resolver.sourceFile(filePath);
  const propsTypeFields: Record<string, ValueType> = {};
  let collected: CollectedTypes = {};
  for (const statement of sourceFile?.statements || []) {
    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.find((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        const { type: fieldType, collected: fieldCollected } =
          resolver.resolveType(
            resolver.checker.getTypeAtLocation(declaration.name)
          );
        propsTypeFields[declaration.name.text] = fieldType;
        collected = { ...collected, ...fieldCollected };
      }
    }
  }
  return {
    propsType: objectType(propsTypeFields),
    types: collected,
  };
}
