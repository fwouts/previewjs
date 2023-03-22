import assertNever from "assert-never";
import type { CollectedTypes, ValueType } from "./definitions";
import { EMPTY_OBJECT_TYPE, UNKNOWN_TYPE } from "./definitions";
import { computeIntersection } from "./intersection";
import { evaluateType } from "./type-parameters";
import { computeUnion } from "./union";

/**
 * Returns the resolved type along with a list of aliases that were resolved.
 *
 * For example for A | B, it may return { foo: string } with ["A", "B"].
 */
export function dereferenceType(
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
    case "tuple":
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
        const [subtype, encounteredInSubtype] = dereferenceType(
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
        const [subtype, encounteredInSubtype] = dereferenceType(
          t,
          collected,
          rejectTypeNames
        );
        subtypes.push(subtype);
        encountered.push(...encounteredInSubtype);
      }
      return [computeIntersection(subtypes), encountered];
    }
    case "name": {
      if (rejectTypeNames.includes(type.name)) {
        return [EMPTY_OBJECT_TYPE, []];
      }
      const resolved = collected[type.name];
      if (!resolved) {
        return [UNKNOWN_TYPE, [type.name]];
      }
      return [evaluateType(resolved, type.args), [type.name]];
    }
    default:
      throw assertNever(type);
  }
}
