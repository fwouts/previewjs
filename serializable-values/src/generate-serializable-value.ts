import {
  ArrayType,
  arrayType,
  CollectedTypes,
  dereferenceType,
  isValid,
  ValueType,
} from "@previewjs/type-analyzer";
import { assertNever } from "assert-never";
import { isValidPropName } from "./prop-name";
import {
  array,
  EMPTY_ARRAY,
  EMPTY_OBJECT,
  FALSE,
  fn,
  map,
  NULL,
  number,
  object,
  promise,
  SerializableArrayValue,
  SerializableObjectValueEntry,
  SerializableValue,
  set,
  string,
  TRUE,
  UNDEFINED,
} from "./serializable-value";

/**
 * Generates a valid value for the given type.
 */
export function generateSerializableValue(
  type: ValueType,
  collected: CollectedTypes,
  isFunctionReturnValue = false
): SerializableValue {
  return _generateSerializableValue(
    type,
    collected,
    [],
    [],
    isFunctionReturnValue
  );
}

function _generateSerializableValue(
  type: ValueType,
  collected: CollectedTypes,
  path: string[],
  rejectTypeNames: string[],
  isFunctionReturnValue: boolean
): SerializableValue {
  let encounteredAliases: string[];
  [type, encounteredAliases] = dereferenceType(
    type,
    collected,
    rejectTypeNames
  );
  rejectTypeNames = [...rejectTypeNames, ...encounteredAliases];
  switch (type.kind) {
    case "any":
    case "unknown":
    case "never":
    case "void":
      return UNDEFINED;
    case "null":
      return NULL;
    case "boolean":
      return FALSE;
    case "string":
    case "node":
      return string(path.length === 0 ? "node" : path.join("."));
    case "number":
      return number(100);
    case "literal":
      if (typeof type.value === "number") {
        return number(type.value);
      } else if (typeof type.value === "string") {
        return string(type.value);
      } else {
        return type.value ? TRUE : FALSE;
      }
    case "enum": {
      const value = Object.values(type.options)[0];
      if (typeof value === "number") {
        return number(value);
      } else {
        return string(value || "unknown");
      }
    }
    case "array":
      return generateArrayValue(
        type,
        collected,
        path,
        rejectTypeNames,
        isFunctionReturnValue
      );
    case "set": {
      return set(
        generateArrayValue(
          arrayType(type.items),
          collected,
          path,
          rejectTypeNames,
          isFunctionReturnValue
        )
      );
    }
    case "object": {
      const entries: SerializableObjectValueEntry[] = [];
      for (const [propName, propType] of Object.entries(type.fields)) {
        const propValue = _generateSerializableValue(
          propType,
          collected,
          [...path, propName],
          rejectTypeNames,
          isFunctionReturnValue
        );
        if (propValue.kind === "undefined") {
          continue;
        }
        if (!isValidPropName(propName)) {
          continue;
        }
        entries.push({
          key: string(propName),
          value: propValue,
        });
      }
      return object(entries);
    }
    case "map":
      return map(EMPTY_OBJECT);
    case "record":
      return EMPTY_OBJECT;
    case "union":
      if (isValid(type, collected, undefined)) {
        return UNDEFINED;
      }
      if (isValid(type, collected, null)) {
        return NULL;
      }
      if (isValid(type, collected, false)) {
        return FALSE;
      }
      return _generateSerializableValue(
        type.types[0]!,
        collected,
        path,
        rejectTypeNames,
        isFunctionReturnValue
      );
    case "intersection":
      // Generate a value for the first type and hope for the best.
      return _generateSerializableValue(
        type.types[0]!,
        collected,
        path,
        rejectTypeNames,
        isFunctionReturnValue
      );
    case "function":
      return fn(
        isFunctionReturnValue
          ? UNDEFINED
          : _generateSerializableValue(
              type.returnType,
              collected,
              path,
              rejectTypeNames,
              true
            )
      );
    case "optional":
      return UNDEFINED;
    case "promise": {
      return promise({
        type: "reject",
        message: null,
      });
    }
    case "name":
      // This recursion is safe specifically because rejectTypeNames
      // is updated before.
      return _generateSerializableValue(
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

function generateArrayValue(
  type: ArrayType,
  collected: CollectedTypes,
  path: string[],
  rejectTypeNames: string[],
  isFunctionReturnValue: boolean
): SerializableArrayValue {
  if (isFunctionReturnValue) {
    // Avoid unnecessarily verbose generated props when they're
    // unlikely to even be used at all.
    return EMPTY_ARRAY;
  }
  const itemValue = _generateSerializableValue(
    type.items,
    collected,
    path,
    rejectTypeNames,
    isFunctionReturnValue
  );
  if (
    itemValue.kind === "undefined" ||
    (itemValue.kind === "object" && Object.keys(itemValue.entries).length === 0)
  ) {
    return EMPTY_ARRAY;
  }
  return array([itemValue]);
}
