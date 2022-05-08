import { ComponentAnalysis } from "@previewjs/core";
import {
  CollectedTypes,
  dereferenceType,
  EMPTY_OBJECT_TYPE,
  helpers,
  objectType,
  TypeResolver,
  UNKNOWN_TYPE,
  ValueType,
} from "@previewjs/type-analyzer";
import ts from "typescript";

export function analyzeSolidComponent(
  typeResolver: TypeResolver,
  absoluteFilePath: string,
  componentName: string,
  signature: ts.Signature
): ComponentAnalysis {
  const sourceFile = typeResolver.sourceFile(absoluteFilePath);
  let args: ts.Expression | null = null;
  if (sourceFile) {
    args = helpers.extractArgs(sourceFile)[componentName] || null;
  }
  let resolved = computePropsType(typeResolver, signature);
  let providedArgs = new Set<string>();
  if (args) {
    const argsType = typeResolver.checker.getTypeAtLocation(args);
    providedArgs = new Set(argsType.getProperties().map((prop) => prop.name));
  }
  return {
    propsType: resolved.type,
    types: { ...resolved.collected },
    providedArgs,
  };
}

function computePropsType(
  typeResolver: TypeResolver,
  signature: ts.Signature
): {
  type: ValueType;
  collected: CollectedTypes;
} {
  return computePropsTypeFromSignature(typeResolver, signature);
}

function computePropsTypeFromSignature(
  typeResolver: TypeResolver,
  signature: ts.Signature
): {
  type: ValueType;
  collected: CollectedTypes;
} {
  const firstParam = signature.getParameters()[0];
  if (!firstParam) {
    return {
      type: EMPTY_OBJECT_TYPE,
      collected: {},
    };
  }
  if (!firstParam.valueDeclaration) {
    return {
      type: UNKNOWN_TYPE,
      collected: {},
    };
  }
  const type = typeResolver.checker.getTypeOfSymbolAtLocation(
    firstParam,
    firstParam.valueDeclaration
  );
  try {
    let { type: propsType, collected } = typeResolver.resolveType(type);
    [propsType] = dereferenceType(propsType, collected, []);
    stripUnusedProps: if (
      propsType.kind === "object" &&
      ts.isParameter(firstParam.valueDeclaration)
    ) {
      if (ts.isObjectBindingPattern(firstParam.valueDeclaration.name)) {
        const bindingPattern = firstParam.valueDeclaration.name;
        const usedProps = new Set<string>();
        for (const element of bindingPattern.elements) {
          if (element.dotDotDotToken) {
            break stripUnusedProps;
          }
          const elementName = element.propertyName || element.name;
          if (!ts.isIdentifier(elementName)) {
            break stripUnusedProps;
          }
          usedProps.add(elementName.text);
        }
        propsType = objectType(
          Object.fromEntries(
            Object.entries(propsType.fields).filter(([key]) =>
              usedProps.has(key)
            )
          )
        );
      }
    }
    return { type: propsType, collected };
  } catch (e) {
    console.warn(
      `Unable to resolve props type for ${typeResolver.checker.typeToString(
        type
      )}`,
      e
    );
  }
  return {
    type: UNKNOWN_TYPE,
    collected: {},
  };
}
