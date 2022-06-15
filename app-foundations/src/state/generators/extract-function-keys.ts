import {
  CollectedTypes,
  evaluateType,
  ValueType,
} from "@previewjs/type-analyzer";

export function extractFunctionKeys(
  propsType: ValueType,
  types: CollectedTypes
): string[] {
  propsType = resolveType(propsType);
  if (propsType.kind !== "object") {
    return [];
  }
  return Object.entries(propsType.fields)
    .filter(
      ([propertyName, propertyType]) =>
        resolveType(propertyType).kind === "function"
    )
    .map(([propertyName]) => propertyName);

  function resolveType(type: ValueType): ValueType {
    if (type.kind === "name") {
      const resolved = types[type.name];
      if (resolved) {
        return evaluateType(resolved, []);
      }
    }
    return type;
  }
}
