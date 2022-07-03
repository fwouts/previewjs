import type { ComponentAnalysis } from "@previewjs/core";
import {
  CollectedTypes,
  objectType,
  optionalType,
  TypeAnalyzer,
  TypeResolver,
  UNKNOWN_TYPE,
  ValueType,
} from "@previewjs/type-analyzer";
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
    const definedProps = extractDefinePropsFromStatement(resolver, statement);
    if (definedProps) {
      return {
        propsType: definedProps.type,
        providedArgs: new Set(),
        types: definedProps.collected,
      };
    }
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

function extractDefinePropsFromStatement(
  resolver: TypeResolver,
  statement: ts.Statement
) {
  if (ts.isExpressionStatement(statement)) {
    // This may be a statement such as `defineProps()`.
    const definedProps = extractDefinePropsFromExpression(
      resolver,
      statement.expression
    );
    if (definedProps) {
      return definedProps;
    }
  }
  if (ts.isVariableStatement(statement)) {
    for (const variableDeclaration of statement.declarationList.declarations) {
      if (!variableDeclaration.initializer) {
        continue;
      }
      const definedProps = extractDefinePropsFromExpression(
        resolver,
        variableDeclaration.initializer
      );
      if (definedProps) {
        return definedProps;
      }
    }
  }
  return null;
}

function extractDefinePropsFromExpression(
  resolver: TypeResolver,
  expression: ts.Expression
): {
  type: ValueType;
  collected: CollectedTypes;
} | null {
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
  ) {
    // This may be an assignment such as `props = defineProps()`.
    return extractDefinePropsFromExpression(resolver, expression.right);
  }
  if (
    !ts.isCallExpression(expression) ||
    !ts.isIdentifier(expression.expression)
  ) {
    return null;
  }
  const functionName = expression.expression.text;
  if (functionName === "defineProps") {
    const signature = resolver.checker.getResolvedSignature(expression);
    if (signature) {
      return resolver.resolveType(signature.getReturnType());
    }
  }
  if (functionName === "withDefaults") {
    const [firstArgument, secondArgument] = expression.arguments;
    if (!firstArgument || !secondArgument) {
      return null;
    }
    const definePropsType = extractDefinePropsFromExpression(
      resolver,
      firstArgument
    );
    if (!definePropsType) {
      return null;
    }
    const defaultsType = resolver.resolveType(
      resolver.checker.getTypeAtLocation(secondArgument)
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
