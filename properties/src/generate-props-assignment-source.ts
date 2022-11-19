import {
  generateSerializableValue,
  serializableValueToJavaScript,
} from "@previewjs/serializable-values";
import {
  CollectedTypes,
  dereferenceType,
  objectType,
  ValueType,
} from "@previewjs/type-analyzer";

/**
 * Generates an invocation source for a specific component.
 *
 * Example:
 * ```
 * properties = { title: "foo" }
 * ```
 */
export function generatePropsAssignmentSource(
  propsType: ValueType,
  providedKeys: string[],
  collected: CollectedTypes
) {
  const providedKeySet = new Set(providedKeys);
  [propsType] = dereferenceType(propsType, collected, []);
  if (propsType.kind === "object") {
    propsType = objectType(
      Object.fromEntries(
        Object.entries(propsType.fields).filter(
          ([fieldName]) => !providedKeySet.has(fieldName)
        )
      )
    );
  }
  const value = generateSerializableValue(propsType, collected);
  let valueSource = serializableValueToJavaScript(value);
  if (valueSource === "undefined") {
    valueSource = "{}";
  }
  return `properties = ${valueSource};`;
}
