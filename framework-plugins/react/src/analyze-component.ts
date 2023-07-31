import type { ComponentProps } from "@previewjs/core";
import type {
  CollectedTypes,
  OptionalType,
  ValueType,
} from "@previewjs/type-analyzer";
import {
  EMPTY_OBJECT_TYPE,
  TypeResolver,
  UNKNOWN_TYPE,
  dereferenceType,
  maybeOptionalType,
  objectType,
  stripUnusedTypes,
} from "@previewjs/type-analyzer";
import type { Logger } from "pino";
import ts from "typescript";
import { detectPropTypes } from "./prop-types.js";

export function analyzeReactComponent(
  logger: Logger,
  typeResolver: TypeResolver,
  absoluteFilePath: string,
  componentName: string,
  signature: ts.Signature
): ComponentProps {
  const sourceFile = typeResolver.sourceFile(absoluteFilePath);
  let propTypes: ts.Expression | null = null;
  if (sourceFile) {
    propTypes = detectPropTypes(sourceFile, componentName);
  }
  const resolved = computePropsType(logger, typeResolver, signature, propTypes);
  return {
    props: resolved.type,
    types: { ...resolved.collected },
  };
}

function computePropsType(
  logger: Logger,
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
  return computePropsTypeFromSignature(logger, typeResolver, signature);
}

function computePropsTypeFromSignature(
  logger: Logger,
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
    let { type: props, collected } = typeResolver.resolveType(type);
    [props] = dereferenceType(props, collected, []);
    stripUnusedProps: if (
      props.kind === "object" &&
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
        props = objectType(
          Object.fromEntries(
            Object.entries(props.fields)
              .filter(([key]) => usedProps.has(key))
              .map(([key, type]) => [
                key,
                maybeOptionalType(type, propsWithDefault.has(key)),
              ])
          )
        );
      }
    }
    return { type: props, collected };
  } catch (e) {
    logger.warn(
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
  const fields: Record<string, ValueType | OptionalType> = {};
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
    collected: stripUnusedTypes(collected, [resolved]),
  };
}
