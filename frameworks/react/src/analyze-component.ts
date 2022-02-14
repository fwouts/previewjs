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
  typeAnalyzer: TypeAnalyzer,
  component: ReactComponent,
  args: ts.Expression | null,
  propTypes: ts.Expression | null
): AnalyzedComponent {
  let resolved = computePropsType(typeAnalyzer, component.signature, propTypes);
  let providedArgs = new Set<string>();
  if (args) {
    const argsType = typeAnalyzer.checker.getTypeAtLocation(args);
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
  typeAnalyzer: TypeAnalyzer,
  signature: ts.Signature,
  propTypes: ts.Expression | null
): {
  type: ValueType;
  collected: CollectedTypes;
} {
  if (propTypes) {
    return computePropsTypeFromPropTypes(typeAnalyzer, propTypes);
  }
  return computePropsTypeFromSignature(typeAnalyzer, signature);
}

function computePropsTypeFromSignature(
  typeAnalyzer: TypeAnalyzer,
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
  const type = typeAnalyzer.checker.getTypeOfSymbolAtLocation(
    firstParam,
    firstParam.valueDeclaration
  );
  try {
    let { type: propsType, collected } = typeAnalyzer.resolveType(type);
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
      `Unable to resolve props type for ${typeAnalyzer.checker.typeToString(
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
  typeAnalyzer: TypeAnalyzer,
  propTypes: ts.Expression
): {
  type: ValueType;
  collected: CollectedTypes;
} {
  const type = typeAnalyzer.checker.getTypeAtLocation(propTypes);
  const fields: Record<string, ValueType> = {};
  let collected: CollectedTypes = {};
  for (const property of type.getProperties()) {
    fields[property.name] = (() => {
      if (!property.valueDeclaration) {
        return UNKNOWN_TYPE;
      }
      const propertyType = typeAnalyzer.checker.getTypeAtLocation(
        property.valueDeclaration
      );
      const typeArguments = typeAnalyzer.resolveTypeArguments(propertyType);
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
