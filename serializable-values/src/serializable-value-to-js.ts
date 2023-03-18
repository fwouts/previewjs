import assertNever from "assert-never";
import prettier from "prettier";
import parserBabel from "prettier/parser-babel.js";
import type { SerializableValue } from "./serializable-value";

export function serializableValueToJavaScript(
  value: SerializableValue
): string {
  let expression = serializableValueToUnformattedJavaScript(value);
  try {
    expression = formatExpression(expression);
  } catch {
    // This can be expected e.g. when code is in the middle of being typed.
    // Example: Promise.reject(new|)
  }
  return expression;
}

function formatExpression(expressionSource: string) {
  const formattedStatement = prettier
    .format(`value = ${expressionSource}`, {
      parser: "babel",
      plugins: [parserBabel],
      filepath: "component.js",
      trailingComma: "none",
    })
    .trim();
  return formattedStatement.replace(/^value = ((.|\s)*);$/m, "$1");
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
      return `() => ${
        value.returnValue.kind === "undefined"
          ? "{}"
          : `(${serializableValueToUnformattedJavaScript(value.returnValue)})`
      }`;
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
