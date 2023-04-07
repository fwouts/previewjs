import type { ComponentAnalysis } from "@previewjs/core";
import { TypeResolver, UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import ts from "typescript";

export function analyzeVueComponentFromTemplate(
  resolver: TypeResolver,
  virtualVueTsAbsoluteFilePath: string
): ComponentAnalysis {
  const sourceFile = resolver.sourceFile(virtualVueTsAbsoluteFilePath);
  for (const statement of sourceFile?.statements || []) {
    if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === "PJS_Props"
    ) {
      const type = resolver.checker.getTypeAtLocation(statement);
      const defineComponentProps = resolver.resolveType(type);
      return {
        propsType: defineComponentProps.type,
        types: defineComponentProps.collected,
      };
    }
  }
  return {
    propsType: UNKNOWN_TYPE,
    types: {},
  };
}
