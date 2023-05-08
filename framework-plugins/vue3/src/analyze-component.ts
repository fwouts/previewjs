import type { ComponentAnalysis } from "@previewjs/core";
import {
  CollectedTypes,
  NODE_TYPE,
  TypeResolver,
  UNKNOWN_TYPE,
  ValueType,
  intersectionType,
  maybeOptionalType,
  objectType,
} from "@previewjs/type-analyzer";
import ts from "typescript";

export function analyzeVueComponentFromTemplate(
  resolver: TypeResolver,
  virtualVueTsAbsoluteFilePath: string
): ComponentAnalysis {
  const sourceFile = resolver.sourceFile(virtualVueTsAbsoluteFilePath);
  let propsType: ValueType = UNKNOWN_TYPE;
  let types: CollectedTypes = {};
  let slots: string[] = [];
  for (const statement of sourceFile?.statements || []) {
    const definedProps = extractDefinePropsFromStatement(resolver, statement);
    if (definedProps) {
      return {
        propsType: definedProps.type,
        types: definedProps.collected,
      };
    }
    if (ts.isTypeAliasDeclaration(statement)) {
      if (statement.name.text === "PJS_Props") {
        const type = resolver.checker.getTypeAtLocation(statement);
        const defineComponentProps = resolver.resolveType(type);
        propsType = defineComponentProps.type;
        types = defineComponentProps.collected;
      } else if (statement.name.text === "PJS_Slots") {
        const slotsType = resolver.checker.getTypeAtLocation(statement);
        const resolvedSlotsTypeName = resolver.resolveType(slotsType);
        if (resolvedSlotsTypeName.type.kind === "name") {
          const resolvedSlotsType =
            resolvedSlotsTypeName.collected[resolvedSlotsTypeName.type.name];
          if (resolvedSlotsType?.type.kind === "tuple") {
            for (const item of resolvedSlotsType.type.items) {
              if (item.kind === "literal" && typeof item.value === "string") {
                slots.push(item.value);
              }
            }
          }
        }
      }
    }
  }
  return {
    propsType: intersectionType([
      propsType,
      objectType(
        Object.fromEntries(
          slots.map((slotName) => [`slot__${slotName}`, NODE_TYPE])
        )
      ),
    ]),
    types,
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
              maybeOptionalType(
                fieldType,
                fieldsWithDefaultValue.has(fieldKey)
              ),
            ]
          )
        )
      ),
      collected: definePropsType.collected,
    };
  }
  return null;
}
