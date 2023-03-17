import type { ComponentAnalysis } from "@previewjs/core";
import {
  maybeOptionalType,
  objectType,
  TypeAnalyzer,
} from "@previewjs/type-analyzer";
import type { ValueType, CollectedTypes } from "@previewjs/type-analyzer";
import ts from "typescript";

export function analyzeSvelteComponentFromSFC(
  typeAnalyzer: TypeAnalyzer,
  filePath: string
): ComponentAnalysis {
  const resolver = typeAnalyzer.analyze([filePath + ".ts"]);
  const sourceFile = resolver.sourceFile(filePath + ".ts");
  const propsTypeFields: Record<string, ValueType> = {};
  let collected: CollectedTypes = {};
  for (const statement of sourceFile?.statements || []) {
    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.find(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      ) &&
      statement.declarationList.flags ^ ts.NodeFlags.Const
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        const { type: fieldType, collected: fieldCollected } =
          resolver.resolveType(
            resolver.checker.getTypeAtLocation(declaration.name)
          );
        propsTypeFields[declaration.name.text] = maybeOptionalType(
          fieldType,
          !!declaration.initializer
        );
        collected = { ...collected, ...fieldCollected };
      }
    }
  }
  return {
    propsType: objectType(propsTypeFields),
    types: collected,
  };
}
