import {
  generateSerializableValue,
  serializableValueToJavaScript,
} from "@previewjs/serializable-values";
import type { CollectedTypes, ValueType } from "@previewjs/type-analyzer";
import { evaluateType } from "@previewjs/type-analyzer";

/**
 * Generates top-level callbacks props, so callbacks such as `onClick` don't need to be set explicitly.
 */
export async function generateCallbackProps(
  props: ValueType,
  types: CollectedTypes
): Promise<{
  source: string;
  keys: string[];
}> {
  props = resolveType(props);
  if (props.kind !== "object") {
    return {
      source: "{}",
      keys: [],
    };
  }
  const propKeys = new Set<string>();
  let text = "";
  text += "{";
  for (const [propertyName, propertyType] of Object.entries(props.fields)) {
    if (propertyType.kind === "optional") {
      continue;
    }
    const resolvedPropertyType = resolveType(propertyType);
    if (resolvedPropertyType.kind === "function") {
      propKeys.add(propertyName);
      text += `"${propertyName.replace(
        /"/g,
        '\\"'
      )}": ${await serializableValueToJavaScript(
        await generateSerializableValue(resolvedPropertyType, types, {
          fieldName: propertyName,
        })
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
