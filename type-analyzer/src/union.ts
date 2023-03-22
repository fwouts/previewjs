import isEqual from "lodash/isEqual";
import { BOOLEAN_TYPE } from ".";
import type { ValueType } from "./definitions";
import { functionType, unionType, VOID_TYPE } from "./definitions";

export function computeUnion(types: ValueType[]): ValueType {
  const evolvingType = types[0];
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
  // Does it have both true and false? Then it's boolean.
  const hasFalse = !!types.find(
    (t) => t.kind === "literal" && t.value === false
  );
  const hasTrue = !!types.find((t) => t.kind === "literal" && t.value === true);
  if (hasFalse && hasTrue) {
    return computeUnion([
      BOOLEAN_TYPE,
      ...types.filter(
        (t) => t.kind !== "literal" || typeof t.value !== "boolean"
      ),
    ]);
  }
  const defaultUnion = unionType(types);
  switch (evolvingType.kind) {
    case "function": {
      const returnTypes = [evolvingType.returnType];
      for (let i = 1; i < types.length; i++) {
        const type = types[i]!;
        if (type.kind !== "function") {
          return defaultUnion;
        }
        returnTypes.push(type.returnType);
      }
      return functionType(computeUnion(returnTypes));
    }
    default:
      return defaultUnion;
  }
}
