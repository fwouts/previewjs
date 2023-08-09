import assertNever from "assert-never";
import { formatExpression } from "./format-expression";
import type {
  SerializableObjectValue,
  SerializableValue,
} from "./serializable-value";
import { object } from "./serializable-value";

export async function serializableValueToJavaScript(
  value: SerializableValue
): Promise<string> {
  return await formatExpression(
    await serializableValueToUnformattedJavaScript(value)
  );
}

async function serializableValueToUnformattedJavaScript(
  value: SerializableValue
): Promise<string> {
  switch (value.kind) {
    case "array":
      return `[${(
        await Promise.all(
          value.items.map((item) =>
            serializableValueToUnformattedJavaScript(item)
          )
        )
      ).join(", ")}]`;
    case "boolean":
      return value.value ? "true" : "false";
    case "function":
      return value.source;
    case "map":
      return `new Map(${
        value.values.entries.length > 0
          ? `Object.entries(${await serializableValueToUnformattedJavaScript(
              value.values
            )})`
          : ""
      })`;
    case "node":
      return value.children
        ? `<${value.tag} ${await unformattedJsxProps(value.props)}>${(
            await Promise.all(
              value.children.map(async (child) => {
                if (
                  child.kind === "string" &&
                  // Whitespaces aren't safe to inline.
                  child.value.trim() === child.value
                ) {
                  return child.value;
                } else if (child.kind === "node") {
                  return await serializableValueToJavaScript(child);
                } else {
                  return `{${await serializableValueToJavaScript(child)}}`;
                }
              })
            )
          ).join("\n")}</${value.tag}>`
        : `<${value.tag} ${await unformattedJsxProps(value.props)} />`;
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
              : `[${await serializableValueToUnformattedJavaScript(entry.key)}]`
          }: ${await serializableValueToUnformattedJavaScript(entry.value)},\n`;
        } else if (entry.kind === "spread") {
          text += `...${await serializableValueToJavaScript(entry.value)},\n`;
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
        return `Promise.resolve(${await serializableValueToUnformattedJavaScript(
          value.value.value
        )})`;
      }
    case "set":
      return `new Set(${
        value.values.items.length > 0
          ? await serializableValueToUnformattedJavaScript(value.values)
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

async function unformattedJsxProps(
  props: SerializableObjectValue
): Promise<string> {
  const attributes: string[] = [];
  for (const prop of props.entries) {
    if (prop.kind === "spread") {
      attributes.push(
        `{...(${await serializableValueToJavaScript(prop.value)})}`
      );
    } else if (prop.key.kind !== "string") {
      attributes.push(
        `...(${await serializableValueToJavaScript(object([prop]))})`
      );
    } else if (prop.value.kind === "boolean" && prop.value.value === true) {
      attributes.push(`${prop.key.value}`);
    } else if (prop.value.kind === "string") {
      attributes.push(`${prop.key.value}=${JSON.stringify(prop.value.value)}`);
    } else {
      attributes.push(
        `${prop.key.value}={${await serializableValueToJavaScript(prop.value)}}`
      );
    }
  }
  return attributes.join("\n");
}
