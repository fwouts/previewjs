import { AnalyzedComponent } from "@previewjs/core";
import { TypescriptAnalyzer } from "@previewjs/core/ts-helpers";
import {
  CollectedTypes,
  objectType,
  optionalType,
  TypeAnalyzer,
  UNKNOWN_TYPE,
  ValueType,
} from "@previewjs/type-analyzer";
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
  // TODO: Also support defineProps() call wrapped in withDefaults().
  // TODO: Also support props being assigned like props = defineProps().
  for (const statement of sourceFile.statements) {
    if (ts.isExpressionStatement(statement)) {
      // This may be a call to defineProps().
      const definedProps = extractDefineProps(
        typeAnalyzer,
        statement.expression
      );
      if (definedProps) {
        return {
          name,
          propsType: definedProps.type,
          providedArgs: new Set(),
          types: definedProps.collected,
        };
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

function extractDefineProps(
  typeAnalyzer: TypeAnalyzer,
  expression: ts.Expression
): {
  type: ValueType;
  collected: CollectedTypes;
} | null {
  if (
    !ts.isCallExpression(expression) ||
    !ts.isIdentifier(expression.expression)
  ) {
    return null;
  }
  const functionName = expression.expression.text;
  if (functionName === "defineProps") {
    const signature = typeAnalyzer.checker.getResolvedSignature(expression);
    if (signature) {
      return typeAnalyzer.resolveType(signature.getReturnType());
    }
  }
  if (functionName === "withDefaults") {
    const [firstArgument, secondArgument] = expression.arguments;
    if (!firstArgument || !secondArgument) {
      return null;
    }
    const definePropsType = extractDefineProps(typeAnalyzer, firstArgument);
    if (!definePropsType) {
      return null;
    }
    const defaultsType = typeAnalyzer.resolveType(
      typeAnalyzer.checker.getTypeAtLocation(secondArgument)
    );
    if (
      defaultsType.type.kind !== "object" ||
      definePropsType.type.kind !== "object"
    ) {
      // Unsure what to do here, ignore defaults.
      return definePropsType;
    }
    const fieldsWithDefaultValue = new Set(
      Object.keys(defaultsType.type.fields)
    );
    return {
      type: objectType(
        Object.fromEntries(
          Object.entries(definePropsType.type.fields).map(
            ([fieldKey, fieldType]) => [
              fieldKey,
              fieldsWithDefaultValue.has(fieldKey)
                ? optionalType(fieldType)
                : fieldType,
            ]
          )
        )
      ),
      collected: definePropsType.collected,
    };
  }
  return null;
}
