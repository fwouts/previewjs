import assertNever from "assert-never";
import { formatExpression } from "./format-expression";
import type { SerializableValue } from "./serializable-value";

export function serializableValueToJavaScript(
  value: SerializableValue
): string {
  return formatExpression(serializableValueToUnformattedJavaScript(value));
}

function serializableValueToUnformattedJavaScript(
  value: SerializableValue
): string {
  switch (value.kind) {
    case "array":
      return `[${value.items
        .map((item) => serializableValueToUnformattedJavaScript(item))
        .join(", ")}]`;
    case "boolean":
      return value.value ? "true" : "false";
    case "function":
      return value.source;
    case "map":
      return `new Map(${
        value.values.entries.length > 0
          ? `Object.entries(${serializableValueToUnformattedJavaScript(
              value.values
            )})`
          : ""
      })`;
    case "null":
      return "null";
    case "number":
      return value.value.toString(10);
    case "object": {
      if (Object.entries(value.entries).length === 0) {
        return "{}";
      }
      let text = "";
      text += "{\n";
      for (const entry of value.entries) {
        if (entry.kind === "key") {
          text += `${
            entry.key.kind === "string"
              ? JSON.stringify(entry.key.value)
              : `[${serializableValueToUnformattedJavaScript(entry.key)}]`
          }: ${serializableValueToUnformattedJavaScript(entry.value)},\n`;
        } else if (entry.kind === "spread") {
          text += `...${serializableValueToJavaScript(entry.value)},\n`;
        } else {
          throw assertNever(entry);
        }
      }
      text += "\n}";
      return text;
    }
    case "promise":
      if (value.value.type === "reject") {
        return `Promise.reject(${
          value.value.message === null
            ? ""
            : `new Error(${JSON.stringify(value.value.message)})`
        })`;
      } else {
        return `Promise.resolve(${serializableValueToUnformattedJavaScript(
          value.value.value
        )})`;
      }
    case "set":
      return `new Set(${
        value.values.items.length > 0
          ? serializableValueToUnformattedJavaScript(value.values)
          : ""
      })`;
    case "string":
      return JSON.stringify(value.value);
    case "undefined":
      return "undefined";
    case "unknown":
      return value.source ?? "{}";
    default:
      throw assertNever(value);
  }
}
