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
 * Generates top-level callbacks props, so callbacks such as `onClick` don't need to be set explicitly.
 */
export function generateCallbackProps(
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
