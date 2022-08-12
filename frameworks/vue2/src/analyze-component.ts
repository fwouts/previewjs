import type { ComponentAnalysis } from "@previewjs/core";
import { TypeAnalyzer, UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import ts from "typescript";

export function analyzeVueComponentFromTemplate(
  typeAnalyzer: TypeAnalyzer,
  absoluteFilePath: string
): ComponentAnalysis {
  // This virtual file exists thanks to transformReader().
  const tsFilePath = `${absoluteFilePath}.ts`;
  const resolver = typeAnalyzer.analyze([tsFilePath]);
  const sourceFile = resolver.sourceFile(tsFilePath);
  for (const statement of sourceFile?.statements || []) {
    if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === "PJS_Props"
    ) {
      const type = resolver.checker.getTypeAtLocation(statement);
      const defineComponentProps = resolver.resolveType(type);
      return {
        propsType: defineComponentProps.type,
        providedArgs: new Set(),
        types: defineComponentProps.collected,
      };
    }
  }
  return {
    propsType: UNKNOWN_TYPE,
    providedArgs: new Set(),
    types: {},
  };
}
