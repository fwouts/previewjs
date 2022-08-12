import type { CollectedTypes, ValueType } from "./definitions";
import { evaluateType } from "./type-parameters";

export function isValid(
  type: ValueType,
  collected: CollectedTypes,
  value: any
): boolean {
  switch (type.kind) {
    case "any":
    case "unknown":
    case "never":
      return true;
    case "void":
      return value === undefined;
    case "null":
      return value === null;
    case "boolean":
      return typeof value === "boolean";
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "node":
      return true;
    case "literal":
      return type.value === value;
    case "enum":
      for (const optionValue of Object.values(type.options)) {
        if (optionValue === value) {
          return true;
        }
      }
      return false;
    case "array":
      if (!Array.isArray(value)) {
        return false;
      }
      for (const itemValue of value) {
        if (!isValid(type.items, collected, itemValue)) {
          return false;
        }
      }
      return true;
    case "set":
      if (!(value instanceof Set)) {
        return false;
      }
      for (const itemValue of value) {
        if (!isValid(type.items, collected, itemValue)) {
          return false;
        }
      }
      return true;
    case "tuple":
      if (!(value instanceof Array)) {
        return false;
      }
      if (value.length !== type.items.length) {
        return false;
      }
      for (let i = 0; i < type.items.length; i++) {
        if (!isValid(type.items[i]!, collected, value[i])) {
          return false;
        }
      }
      return true;
    case "object":
      // Functions can be objects too, i.e. you can add fields onto them.
      if (
        !value ||
        (typeof value !== "object" && typeof value !== "function")
      ) {
        return false;
      }
      for (const [propName, propType] of Object.entries(type.fields)) {
        const propValue = value[propName];
        if (!isValid(propType, collected, propValue)) {
          return false;
        }
      }
      return true;
    case "map":
      if (!(value instanceof Map)) {
        return false;
      }
      for (const [propKey, propValue] of value.entries()) {
        if (!isValid(type.keys, collected, propKey)) {
          return false;
        }
        if (!isValid(type.values, collected, propValue)) {
          return false;
        }
      }
      return true;
    case "record":
      if (!value || typeof value !== "object") {
        return false;
      }
      for (const [propKey, propValue] of Object.entries(value)) {
        if (!isValid(type.keys, collected, propKey)) {
          return false;
        }
        if (!isValid(type.values, collected, propValue)) {
          return false;
        }
      }
      return true;
    case "union":
      for (const subtype of type.types) {
        if (isValid(subtype, collected, value)) {
          return true;
        }
      }
      return false;
    case "intersection":
      for (const subtype of type.types) {
        if (!isValid(subtype, collected, value)) {
          return false;
        }
      }
      return true;
    case "function":
      return typeof value === "function";
    case "optional":
      return value === undefined || isValid(type.type, collected, value);
    case "promise":
      return value && typeof value === "object" && "then" in value;
    case "name": {
      const resolvedType = collected[type.name];
      if (!resolvedType) {
        // For now, this is a sign of a type parameter. Just say yes.
        return true;
      }
      return isValid(evaluateType(resolvedType, type.args), collected, value);
    }
  }
}
