import type { ComponentAnalysis } from "@previewjs/core";
import {
  dereferenceType,
  EMPTY_OBJECT_TYPE,
  maybeOptionalType,
  objectType,
  TypeResolver,
  UNKNOWN_TYPE,
} from "@previewjs/type-analyzer";
import ts from "typescript";

export function analyzePreactComponent(
  typeResolver: TypeResolver,
  signature: ts.Signature
): ComponentAnalysis {
  const firstParam = signature.getParameters()[0];
  if (!firstParam) {
    return {
      propsType: EMPTY_OBJECT_TYPE,
      types: {},
    };
  }
  if (!firstParam.valueDeclaration) {
    return {
      propsType: UNKNOWN_TYPE,
      types: {},
    };
  }
  const type = typeResolver.checker.getTypeOfSymbolAtLocation(
    firstParam,
    firstParam.valueDeclaration
  );
  try {
    let { type: propsType, collected: types } = typeResolver.resolveType(type);
    [propsType] = dereferenceType(propsType, types, []);
    stripUnusedProps: if (
      propsType.kind === "object" &&
      ts.isParameter(firstParam.valueDeclaration)
    ) {
      if (ts.isObjectBindingPattern(firstParam.valueDeclaration.name)) {
        const bindingPattern = firstParam.valueDeclaration.name;
        const usedProps = new Set<string>();
        // TODO: Integrate this into Solid plugin as well.
        const propsWithDefault = new Set<string>();
        for (const element of bindingPattern.elements) {
          if (element.dotDotDotToken) {
            break stripUnusedProps;
          }
          const elementName = element.propertyName || element.name;
          if (!ts.isIdentifier(elementName)) {
            break stripUnusedProps;
          }
          usedProps.add(elementName.text);
          if (element.initializer) {
            propsWithDefault.add(elementName.text);
          }
        }
        propsType = objectType(
          Object.fromEntries(
            Object.entries(propsType.fields)
              .filter(([key]) => usedProps.has(key))
              .map(([key, type]) => [
                key,
                maybeOptionalType(type, propsWithDefault.has(key)),
              ])
          )
        );
      }
    }
    if (propsType.kind === "object") {
      propsType = {
        kind: "object",
        fields: Object.fromEntries(
          Object.entries(propsType.fields).filter(
            ([key]) => !["jsx", "key", "ref"].includes(key)
          )
        ),
      };
    }
    return { propsType, types };
  } catch (e) {
    console.warn(
      `Unable to resolve props type for ${typeResolver.checker.typeToString(
        type
      )}`,
      e
    );
  }
  return {
    propsType: UNKNOWN_TYPE,
    types: {},
  };
}
