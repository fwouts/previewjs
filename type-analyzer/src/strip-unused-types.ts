import assertNever from "assert-never";
import type { CollectedTypes, ValueType } from "./definitions";

export function stripUnusedTypes(
  collected: CollectedTypes,
  types: ValueType[]
) {
  const visitedTypeNames = new Set<string>();
  for (const type of types) {
    visitType(type);
  }
  return Object.fromEntries(
    Object.entries(collected).filter(([name]) => visitedTypeNames.has(name))
  );

  function visitType(type: ValueType): void {
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
        // Nothing to do.
        return;
      case "array":
      case "set":
        visitType(type.items);
        return;
      case "tuple":
        for (const subtype of type.items) {
          visitType(subtype);
        }
        return;
      case "object":
        for (const fieldType of Object.values(type.fields)) {
          visitType(fieldType.kind === "optional" ? fieldType.type : fieldType);
        }
        return;
      case "map":
      case "record":
        visitType(type.keys);
        visitType(type.values);
        return;
      case "function":
        visitType(type.returnType);
        return;
      case "promise":
        visitType(type.type);
        return;
      case "union":
      case "intersection":
        for (const subtype of type.types) {
          visitType(subtype);
        }
        return;
      case "name": {
        for (const argType of type.args) {
          visitType(argType);
        }
        if (visitedTypeNames.has(type.name)) {
          return;
        }
        visitedTypeNames.add(type.name);
        const resolvedType = collected[type.name];
        if (!resolvedType) {
          return;
        }
        visitType(resolvedType.type);
        for (const defaultArgType of type.args) {
          visitType(defaultArgType);
        }
        return;
      }
      default:
        throw assertNever(type);
    }
  }
}
