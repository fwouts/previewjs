import type { ComponentAnalysis } from "@previewjs/core";
import {
  CollectedTypes,
  dereferenceType,
  EMPTY_OBJECT_TYPE,
  helpers,
  maybeOptionalType,
  objectType,
  stripUnusedTypes,
  TypeResolver,
  UNKNOWN_TYPE,
  ValueType,
} from "@previewjs/type-analyzer";
import ts from "typescript";
import { detectPropTypes } from "./prop-types";

export function analyzeReactComponent(
  typeResolver: TypeResolver,
  absoluteFilePath: string,
  componentName: string,
  signature: ts.Signature
): ComponentAnalysis {
  const sourceFile = typeResolver.sourceFile(absoluteFilePath);
  let args: ts.Expression | null = null;
  let propTypes: ts.Expression | null = null;
  if (sourceFile) {
    args = helpers.extractArgs(sourceFile)[componentName] || null;
    propTypes = detectPropTypes(sourceFile, componentName);
  }
  let resolved = computePropsType(typeResolver, signature, propTypes);
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
  signature: ts.Signature,
  propTypes: ts.Expression | null
): {
  type: ValueType;
  collected: CollectedTypes;
} {
  if (propTypes) {
    return computePropsTypeFromPropTypes(typeResolver, propTypes);
  }
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

function computePropsTypeFromPropTypes(
  typeResolver: TypeResolver,
  propTypes: ts.Expression
): {
  type: ValueType;
  collected: CollectedTypes;
} {
  const type = typeResolver.checker.getTypeAtLocation(propTypes);
  const fields: Record<string, ValueType> = {};
  let collected: CollectedTypes = {};
  for (const property of type.getProperties()) {
    fields[property.name] = (() => {
      if (!property.valueDeclaration) {
        return UNKNOWN_TYPE;
      }
      const propertyType = typeResolver.checker.getTypeAtLocation(
        property.valueDeclaration
      );
      const typeArguments = typeResolver.resolveTypeArguments(propertyType);
      const fieldType = typeArguments.types[0];
      if (fieldType) {
        collected = {
          ...collected,
          ...typeArguments.collected,
        };
        return maybeOptionalType(
          fieldType,
          propertyType.symbol.name === "Requireable"
        );
      }
      return UNKNOWN_TYPE;
    })();
  }
  const resolved = objectType(fields);
  return {
    type: resolved,
    collected: stripUnusedTypes(collected, resolved),
  };
}
