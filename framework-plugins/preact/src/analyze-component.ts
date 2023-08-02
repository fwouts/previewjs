import type { ComponentProps } from "@previewjs/component-analyzer-api";
import type { TypeResolver } from "@previewjs/type-analyzer";
import {
  dereferenceType,
  EMPTY_OBJECT_TYPE,
  maybeOptionalType,
  objectType,
  UNKNOWN_TYPE,
} from "@previewjs/type-analyzer";
import type { Logger } from "pino";
import ts from "typescript";

export function analyzePreactComponent(
  logger: Logger,
  typeResolver: TypeResolver,
  signature: ts.Signature
): ComponentProps {
  const firstParam = signature.getParameters()[0];
  if (!firstParam) {
    return {
      props: EMPTY_OBJECT_TYPE,
      types: {},
    };
  }
  if (!firstParam.valueDeclaration) {
    return {
      props: UNKNOWN_TYPE,
      types: {},
    };
  }
  const type = typeResolver.checker.getTypeOfSymbolAtLocation(
    firstParam,
    firstParam.valueDeclaration
  );
  try {
    let { type: props, collected: types } = typeResolver.resolveType(type);
    [props] = dereferenceType(props, types, []);
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
    if (props.kind === "object") {
      props = {
        kind: "object",
        fields: Object.fromEntries(
          Object.entries(props.fields).filter(
            ([key]) => !["jsx", "key", "ref"].includes(key)
          )
        ),
      };
    }
    return { props, types };
  } catch (e) {
    logger.warn(
      `Unable to resolve props type for ${typeResolver.checker.typeToString(
        type
      )}`,
      e
    );
  }
  return {
    props: UNKNOWN_TYPE,
    types: {},
  };
}
