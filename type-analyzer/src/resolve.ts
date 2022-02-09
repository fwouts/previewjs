import assertNever from "assert-never";
import {
  CollectedTypes,
  optionalType,
  UNKNOWN_TYPE,
  ValueType,
} from "./definitions";
import { computeIntersection } from "./intersection";
import { resolveTypeArguments } from "./type-parameters";
import { computeUnion } from "./union";

/**
 * Returns the resolved type along with a list of aliases that were resolved.
 *
 * For example for A | B, it may return { foo: string } with ["A", "B"].
 */
export function resolveType(
  type: ValueType,
  collected: CollectedTypes,
  rejectTypeNames: string[]
): [ValueType, string[]] {
  switch (type.kind) {
    case "any":
    case "unknown":
    case "never":
    case "void":
    case "null":
    case "boolean":
    case "string":
    case "node":
    case "number":
    case "literal":
    case "enum":
    case "array":
    case "set":
    case "object":
    case "map":
    case "record":
    case "function":
    case "promise":
      return [type, []];
    case "union": {
      const encountered: string[] = [];
      const subtypes: ValueType[] = [];
      for (const t of type.types) {
        const [subtype, encounteredInSubtype] = resolveType(
          t,
          collected,
          rejectTypeNames
        );
        subtypes.push(subtype);
        encountered.push(...encounteredInSubtype);
      }
      return [computeUnion(subtypes), encountered];
    }
    case "intersection": {
      const encountered: string[] = [];
      const subtypes: ValueType[] = [];
      for (const t of type.types) {
        const [subtype, encounteredInSubtype] = resolveType(
          t,
          collected,
          rejectTypeNames
        );
        subtypes.push(subtype);
        encountered.push(...encounteredInSubtype);
      }
      return [computeIntersection(subtypes), encountered];
    }
    case "optional": {
      const [resolved, encountered] = resolveType(
        type.type,
        collected,
        rejectTypeNames
      );
      return [optionalType(resolved), encountered];
    }
    case "name": {
      if (rejectTypeNames.includes(type.name)) {
        return [UNKNOWN_TYPE, []];
      }
      const resolved = collected[type.name];
      if (!resolved) {
        return [UNKNOWN_TYPE, [type.name]];
      }
      return [resolveTypeArguments(resolved, type.args), [type.name]];
    }
    default:
      throw assertNever(type);
  }
}
