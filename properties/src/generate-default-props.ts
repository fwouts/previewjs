import {
  generateSerializableValue,
  serializableValueToJavaScript,
} from "@previewjs/serializable-values";
import {
  CollectedTypes,
  evaluateType,
  ValueType,
} from "@previewjs/type-analyzer";

/**
 * Generates props that will be set on a component even if no props are specified.
 *
 * In particular, this is useful for callbacks like `onClick` which don't need to be set explicitly.
 */
export function generateDefaultProps(
  propsType: ValueType,
  types: CollectedTypes
): {
  source: string;
  keys: string[];
} {
  propsType = resolveType(propsType);
  if (propsType.kind !== "object") {
    return {
      source: "{}",
      keys: [],
    };
  }
  const propKeys = new Set<string>();
  let text = "";
  text += "{";
  for (const [propertyName, propertyType] of Object.entries(propsType.fields)) {
    const resolvedPropertyType = resolveType(propertyType);
    if (resolvedPropertyType.kind === "function") {
      propKeys.add(propertyName);
      text += `"${propertyName.replace(
        /"/g,
        '\\"'
      )}": ${serializableValueToJavaScript(
        generateSerializableValue(resolvedPropertyType, types)
      )},`;
    }
  }
  text += "}";
  return {
    source: text,
    keys: [...propKeys],
  };

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
