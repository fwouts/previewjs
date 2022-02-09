import {
  CollectedTypes,
  objectType,
  resolveType,
  ValueType,
} from "@previewjs/type-analyzer";
import prettier from "prettier";
import { generateValue } from "./generate-value";

/**
 * Generates an invocation source for a specific component.
 *
 * Example:
 * ```
 * properties = { title: "foo" }
 * ```
 */
export function generateInvocation(
  propsType: ValueType,
  providedKeys: ReadonlySet<string>,
  collected: CollectedTypes
) {
  [propsType] = resolveType(propsType, collected, []);
  if (propsType.kind === "object") {
    propsType = objectType(
      Object.fromEntries(
        Object.entries(propsType.fields).filter(
          ([fieldName]) => !providedKeys.has(fieldName)
        )
      )
    );
  }
  let value = generateValue(propsType, collected, [], [], false);
  if (value === "undefined") {
    value = "{}";
  }
  const source = `properties = ${value}`;
  return prettier
    .format(source, {
      filepath: "component.js",
    })
    .trim();
}
