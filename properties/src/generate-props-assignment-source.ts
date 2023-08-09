import {
  generateSerializableValue,
  serializableValueToJavaScript,
} from "@previewjs/serializable-values";
import type { CollectedTypes, ValueType } from "@previewjs/type-analyzer";
import { dereferenceType, objectType } from "@previewjs/type-analyzer";

/**
 * Generates an invocation source for a specific component.
 *
 * Example:
 * ```
 * properties = { title: "foo" }
 * ```
 */
export async function generatePropsAssignmentSource(
  props: ValueType,
  providedKeys: string[],
  collected: CollectedTypes
) {
  const providedKeySet = new Set(providedKeys);
  [props] = dereferenceType(props, collected, []);
  if (props.kind === "object") {
    props = objectType(
      Object.fromEntries(
        Object.entries(props.fields).filter(
          ([fieldName]) => !providedKeySet.has(fieldName)
        )
      )
    );
  }
  const value = await generateSerializableValue(props, collected);
  let valueSource = await serializableValueToJavaScript(value);
  if (valueSource === "undefined") {
    valueSource = "{}";
  }
  return `properties = ${valueSource};`;
}
