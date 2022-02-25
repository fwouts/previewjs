import { AnalyzedComponent } from "@previewjs/core";
import { TypeAnalyzer, UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import path from "path";
import ts from "typescript";

export function analyzeVueComponentFromTemplate(
  typeAnalyzer: TypeAnalyzer,
  filePath: string
): AnalyzedComponent {
  // This virtual file exists thanks to transformReader().
  const tsFilePath = `${filePath}.ts`;
  const name = path.basename(filePath, path.extname(filePath));
  const resolver = typeAnalyzer.analyze([tsFilePath]);
  const sourceFile = resolver.sourceFile(tsFilePath);
  for (const statement of sourceFile.statements) {
    if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === "PJS_Props"
    ) {
      const type = resolver.checker.getTypeAtLocation(statement);
      const defineComponentProps = resolver.resolveType(type);
      return {
        name,
        propsType: defineComponentProps.type,
        providedArgs: new Set(),
        types: defineComponentProps.collected,
      };
    }
  }
  return {
    name,
    propsType: UNKNOWN_TYPE,
    providedArgs: new Set(),
    types: {},
  };
}
