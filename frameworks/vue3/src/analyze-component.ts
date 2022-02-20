import { AnalyzedComponent } from "@previewjs/core";
import { TypeAnalyzer, UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import path from "path";
import ts from "typescript";

export function analyzeVueComponentFromTemplate(
  typeAnalyzer: TypeAnalyzer,
  filePath: string
): AnalyzedComponent {
  const name = path.basename(filePath, path.extname(filePath));
  const sourceFile = typeAnalyzer.sourceFile(filePath);
  // TODO: Also support defineProps() call wrapped in withDefaults().
  // TODO: Also support props being assigned like props = defineProps().
  for (const statement of sourceFile.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      ts.isIdentifier(statement.expression.expression)
    ) {
      const calledFunction = statement.expression.expression.text;
      if (calledFunction === "defineProps") {
        const signature = typeAnalyzer.checker.getResolvedSignature(
          statement.expression
        );
        if (signature) {
          const { type: propsType, collected: types } =
            typeAnalyzer.resolveType(signature.getReturnType());
          return {
            name,
            propsType,
            providedArgs: new Set(),
            types,
          };
        }
      }
      // TODO: Also defineComponent.
    }
  }
  return {
    name,
    propsType: UNKNOWN_TYPE,
    providedArgs: new Set(),
    types: {},
  };
}
