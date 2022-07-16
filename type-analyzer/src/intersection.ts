import isEqual from "lodash/isEqual";
import {
  functionType,
  intersectionType,
  ValueType,
  VOID_TYPE,
} from "./definitions";

export function computeIntersection(types: ValueType[]): ValueType {
  types = types.filter((type, i) => {
    // `string & {}` is used as a hack to prevent string literals
    // in unions from being merged with the `string` type.
    // See https://github.com/microsoft/TypeScript/issues/29729.
    return (
      i === 0 || type.kind !== "object" || Object.keys(type.fields).length > 0
    );
  });
  let evolvingType = types[0];
  if (!evolvingType) {
    return VOID_TYPE;
  }
  // Are they all the same type? (or is there only one)
  let identical = true;
  for (let i = 1; i < types.length; i++) {
    if (!isEqual(evolvingType, types[i])) {
      identical = false;
    }
  }
  if (identical) {
    return evolvingType;
  }
  const defaultIntersection = intersectionType(types);
  switch (evolvingType.kind) {
    case "function": {
      const returnTypes = [evolvingType.returnType];
      for (let i = 1; i < types.length; i++) {
        const type = types[i]!;
        if (type.kind !== "function") {
          return defaultIntersection;
        }
        returnTypes.push(type.returnType);
      }
      return functionType(computeIntersection(returnTypes));
    }
    case "object":
      for (let i = 1; i < types.length; i++) {
        const intersectWith = types[i]!;
        if (intersectWith.kind !== "object") {
          return defaultIntersection;
        }
        const intersectingFields: Array<[string, ValueType]> = [];
        for (const fieldName of new Set([
          ...Object.keys(evolvingType.fields),
          ...Object.keys(intersectWith.fields),
        ])) {
          const evolvingFieldType = evolvingType.fields[fieldName];
          const intersectingFieldType = intersectWith.fields[fieldName];
          const fieldType =
            evolvingFieldType && intersectingFieldType
              ? computeIntersection([evolvingFieldType, intersectingFieldType])
              : evolvingFieldType
              ? evolvingFieldType
              : intersectingFieldType;
          if (!fieldType) {
            throw new Error(
              `Could not compute type of intersection field ${fieldName}`
            );
          }
          intersectingFields.push([fieldName, fieldType]);
        }
        evolvingType = {
          kind: "object",
          fields: Object.fromEntries(intersectingFields),
        };
      }
      return evolvingType;
    default:
      return defaultIntersection;
  }
}
