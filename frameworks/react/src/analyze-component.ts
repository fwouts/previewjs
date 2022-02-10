import { AnalyzedComponent } from "@previewjs/core";
import {
  CollectedTypes,
  EMPTY_OBJECT_TYPE,
  maybeOptionalType,
  objectType,
  resolveType,
  TypeAnalyzer,
  UNKNOWN_TYPE,
  ValueType,
} from "@previewjs/type-analyzer";
import ts from "typescript";
import { ReactComponent } from ".";

export function analyzeReactComponent(
  typeResolver: TypeAnalyzer,
  component: ReactComponent,
  args: ts.Expression | null,
  propTypes: ts.Expression | null
): AnalyzedComponent {
  let resolved = computePropsType(typeResolver, component.signature, propTypes);
  let providedArgs = new Set<string>();
  if (args) {
    const argsType = typeResolver.checker.getTypeAtLocation(args);
    providedArgs = new Set(argsType.getProperties().map((prop) => prop.name));
  }
  return {
    name: component.name,
    propsType: resolved.type,
    types: { ...resolved.collected },
    providedArgs,
  };
}

function computePropsType(
  typeResolver: TypeAnalyzer,
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
  typeResolver: TypeAnalyzer,
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
    [propsType] = resolveType(propsType, collected, []);
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

function computePropsTypeFromPropTypes(
  typeResolver: TypeAnalyzer,
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
  return {
    type: objectType(fields),
    collected: {},
  };
}
