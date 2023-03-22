import assertNever from "assert-never";
import type { ParameterizableType, ValueType } from "./definitions";
import {
  arrayType,
  functionType,
  mapType,
  maybeOptionalType,
  objectType,
  promiseType,
  recordType,
  setType,
  tupleType,
  UNKNOWN_TYPE,
} from "./definitions";
import { computeIntersection } from "./intersection";
import { computeUnion } from "./union";

export function evaluateType(
  type: ParameterizableType,
  typeArguments: ValueType[]
): ValueType {
  let i = 0;
  let result = type.type;
  const defaultParameterTypes = { ...type.parameters };
  const typeKeys = Object.keys(type.parameters);
  for (const name of typeKeys) {
    const defaultParameterType = defaultParameterTypes[name];
    const typeArgument =
      typeArguments[i] || defaultParameterType || UNKNOWN_TYPE;
    result = replaceNamedType(result, name, typeArgument);
    // Replace the type parameter in subsequent optional type parameters.
    // Luckily TypeScript guarantees that optional types always follow
    // required ones.
    for (let j = i + 1; j < typeKeys.length; j++) {
      const otherTypeName = typeKeys[j]!;
      const otherTypeDefault = defaultParameterTypes[otherTypeName];
      if (otherTypeDefault) {
        defaultParameterTypes[otherTypeName] = replaceNamedType(
          otherTypeDefault,
          name,
          typeArgument
        );
      }
    }
    i++;
  }
  return result;
}

function replaceNamedType(
  type: ValueType,
  named: string,
  replacement: ValueType
): ValueType {
  switch (type.kind) {
    case "any":
    case "unknown":
    case "never":
    case "void":
    case "null":
    case "boolean":
    case "string":
    case "node":
    case "number":
    case "literal":
    case "enum":
      return type;
    case "array":
      return arrayType(replaceNamedType(type.items, named, replacement));
    case "set":
      return setType(replaceNamedType(type.items, named, replacement));
    case "tuple":
      return tupleType(
        type.items.map((t) => replaceNamedType(t, named, replacement))
      );
    case "map":
      return mapType(
        replaceNamedType(type.keys, named, replacement),
        replaceNamedType(type.values, named, replacement)
      );
    case "record":
      return recordType(
        replaceNamedType(type.keys, named, replacement),
        replaceNamedType(type.values, named, replacement)
      );
    case "object":
      return objectType(
        Object.fromEntries(
          Object.entries(type.fields).map(([key, fieldType]) => [
            key,
            maybeOptionalType(
              replaceNamedType(
                fieldType.kind === "optional" ? fieldType.type : fieldType,
                named,
                replacement
              ),
              fieldType.kind === "optional"
            ),
          ])
        )
      );
    case "union":
      return computeUnion(
        type.types.map((t) => replaceNamedType(t, named, replacement))
      );
    case "intersection":
      return computeIntersection(
        type.types.map((t) => replaceNamedType(t, named, replacement))
      );
    case "function":
      return functionType(
        replaceNamedType(type.returnType, named, replacement)
      );
    case "promise":
      return promiseType(replaceNamedType(type.type, named, replacement));
    case "name":
      if (type.name === named) {
        return replacement;
      }
      return {
        kind: "name",
        name: type.name,
        args: type.args.map((arg) => replaceNamedType(arg, named, replacement)),
      };
    default:
      throw assertNever(type);
  }
}
