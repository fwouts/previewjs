import assertNever from "assert-never";
import { isValidPropName } from "./prop-name";
import { SerializableValue } from "./serializable-value";

export function serializableValueToJavaScript(
  value: SerializableValue
): string {
  switch (value.kind) {
    case "array":
      return `[${value.items
        .map((item) => serializableValueToJavaScript(item))
        .join(", ")}]`;
    case "boolean":
      return value.value ? "true" : "false";
    case "function":
      return `() => ${
        value.returnValue.kind === "undefined"
          ? "{}"
          : `(${serializableValueToJavaScript(value.returnValue)})`
      }`;
    case "map":
      return `new Map(Object.entries(${serializableValueToJavaScript(
        value.values
      )}))`;
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
      for (const [propName, propValue] of Object.entries(value.entries)) {
        if (!isValidPropName(propName)) {
          continue;
        }
        text += `${propName}: ${serializableValueToJavaScript(propValue)},\n`;
      }
      text += "\n}";
      return text;
    }
    case "promise":
      if (value.value.type === "reject") {
        return `Promise.reject(${
          value.value.message === null
            ? ""
            : JSON.stringify(value.value.message)
        })`;
      } else {
        return `Promise.resolve(${serializableValueToJavaScript(
          value.value.value
        )})`;
      }
    case "set":
      return `new Set(${serializableValueToJavaScript(value.values)})`;
    case "string":
      return JSON.stringify(value.value);
    case "undefined":
      return "undefined";
    case "unknown":
      return "{}";
    default:
      throw assertNever(value);
  }
}
