import { AnalyzedComponent } from "@previewjs/core";
import { TypescriptAnalyzer } from "@previewjs/core/ts-helpers";
import { TypeAnalyzer, UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import path from "path";
import ts from "typescript";

export function analyzeVueComponentFromTemplate(
  typescriptAnalyzer: TypescriptAnalyzer,
  getTypeAnalyzer: (program: ts.Program) => TypeAnalyzer,
  filePath: string
): AnalyzedComponent {
  // This virtual file exists thanks to transformReader().
  const tsFilePath = `${filePath}.ts`;
  const name = path.basename(filePath, path.extname(filePath));
  const program = typescriptAnalyzer.analyze([tsFilePath]);
  const typeAnalyzer = getTypeAnalyzer(program);
  const sourceFile = typeAnalyzer.sourceFile(tsFilePath);
  for (const statement of sourceFile.statements) {
    if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === "PJS_Props"
    ) {
      const type = typeAnalyzer.checker.getTypeAtLocation(statement);
      const defineComponentProps = typeAnalyzer.resolveType(type);
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
