import {
  arrayType,
  CollectedTypes,
  isValid,
  resolveType,
  ValueType,
} from "@previewjs/type-analyzer";
import { assertNever } from "assert-never";
import { isValidPropName } from "./prop-name";

/**
 * Generates a valid value for the given type.
 */
export function generateValue(
  type: ValueType,
  collected: CollectedTypes,
  path: string[],
  rejectTypeNames: string[],
  isFunctionReturnValue: boolean
): string {
  let encounteredAliases: string[];
  [type, encounteredAliases] = resolveType(type, collected, rejectTypeNames);
  rejectTypeNames = [...rejectTypeNames, ...encounteredAliases];
  switch (type.kind) {
    case "any":
    case "unknown":
    case "never":
    case "void":
      return "undefined";
    case "null":
      return "null";
    case "boolean":
      return "false";
    case "string":
    case "node":
      if (path.length === 0) {
        return '"node"';
      }
      return `"${path.join(".").replace(/"/g, '\\"')}"`;
    case "number":
      return "100";
    case "literal":
      if (typeof type.value === "number") {
        return type.value.toString(10);
      } else if (typeof type.value === "string") {
        return `"${type.value.replace(/"/g, '\\"')}"`;
      } else {
        return type.value ? "true" : "false";
      }
    case "enum":
      const value = Object.values(type.options)[0];
      if (typeof value === "number") {
        return value.toString(10);
      } else {
        return `"${value!.replace(/"/g, '\\"')}"`;
      }
    case "array": {
      if (isFunctionReturnValue) {
        // Avoid unnecessarily verbose generated props when they're
        // unlikely to even be used at all.
        return "[]";
      }
      const itemValue = generateValue(
        type.items,
        collected,
        path,
        rejectTypeNames,
        isFunctionReturnValue
      );
      if (itemValue === "undefined" || itemValue === "{}") {
        return "[]";
      }
      return `[${itemValue}]`;
    }
    case "set": {
      return `new Set(${generateValue(
        arrayType(type.items),
        collected,
        path,
        rejectTypeNames,
        isFunctionReturnValue
      )})`;
    }
    case "object": {
      let text = "";
      text += "{\n";
      for (const [propName, propType] of Object.entries(type.fields)) {
        const propValue = generateValue(
          propType,
          collected,
          [...path, propName],
          rejectTypeNames,
          isFunctionReturnValue
        );
        if (propValue === "undefined") {
          continue;
        }
        if (!isValidPropName(propName)) {
          continue;
        }
        text += `${propName}: ${propValue},\n`;
      }
      text += "\n}";
      return text;
    }
    case "map":
      return "new Map()";
    case "record":
      return "{}";
    case "union":
      if (isValid(type, collected, undefined)) {
        return "undefined";
      }
      if (isValid(type, collected, null)) {
        return "null";
      }
      if (isValid(type, collected, false)) {
        return "false";
      }
      return generateValue(
        type.types[0]!,
        collected,
        path,
        rejectTypeNames,
        isFunctionReturnValue
      );
    case "intersection":
      // Generate a value for the first type and hope for the best.
      return generateValue(
        type.types[0]!,
        collected,
        path,
        rejectTypeNames,
        isFunctionReturnValue
      );
    case "function":
      const returnValue = isFunctionReturnValue
        ? "undefined"
        : generateValue(
            type.returnType,
            collected,
            path,
            rejectTypeNames,
            true
          );
      return `() => ${returnValue === "undefined" ? `{}` : `(${returnValue})`}`;
    case "optional":
      return "undefined";
    case "promise": {
      return `Promise.reject()`;
    }
    case "name":
      // This recursion is safe specifically because rejectTypeNames
      // is updated before.
      return generateValue(
        type,
        collected,
        path,
        rejectTypeNames,
        isFunctionReturnValue
      );
    default:
      throw assertNever(type);
  }
}
