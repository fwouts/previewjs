import assertNever from "assert-never";
import type { CollectedTypes, ValueType } from "./definitions";
import { safeTypeName } from "./type-names";

export function generateType(
  type: ValueType,
  collected: CollectedTypes,
  typeNameMapping: {
    [name: string]: string;
  } = {}
) {
  return generateTypeInternal(type, collected, typeNameMapping, new Set());
}

export function generateTypeInternal(
  type: ValueType,
  collected: CollectedTypes,
  typeNameMapping: {
    [name: string]: string;
  },
  usedTypes: Set<string>
): string {
  switch (type.kind) {
    case "any":
      return "any";
    case "unknown":
      return "unknown";
    case "never":
      return "never";
    case "void":
      return "void";
    case "null":
      return "null";
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    case "number":
      return "number";
    case "node":
      // Since React type definitions aren't included in the editor, we need to use "any" here.
      return "any";
    case "literal":
      if (typeof type.value === "number") {
        return type.value.toString(10);
      } else if (typeof type.value === "string") {
        return `"${type.value.replace(/"/g, '\\"')}"`;
      } else {
        return type.value ? "true" : "false";
      }
    case "enum":
      return Object.values(type.options)
        .map((value) =>
          typeof value === "number"
            ? value.toString(10)
            : `"${value.replace(/"/g, '\\"')}"`
        )
        .join(" | ");
    case "array":
      return `Array<${generateTypeInternal(
        type.items,
        collected,
        typeNameMapping,
        usedTypes
      )}>`;
    case "set":
      return `Set<${generateTypeInternal(
        type.items,
        collected,
        typeNameMapping,
        usedTypes
      )}>`;
    case "tuple":
      return `[${type.items
        .map((item) =>
          generateTypeInternal(item, collected, typeNameMapping, usedTypes)
        )
        .join(", ")}]`;
    case "object":
      return `{
                ${Object.entries(type.fields)
                  .map(([propName, propType]) => {
                    const resolvedPropType =
                      propType.kind === "name"
                        ? collected[propType.name]?.type || propType
                        : propType;
                    const optional =
                      propType.kind === "optional" ||
                      resolvedPropType.kind === "any" ||
                      resolvedPropType.kind === "unknown";
                    return `["${propName.replace(/"/g, '\\"')}"]${
                      optional ? "?" : ""
                    }: ${generateTypeInternal(
                      propType.kind === "optional" ? propType.type : propType,
                      collected,
                      typeNameMapping,
                      usedTypes
                    )}`;
                  })
                  .join("\n")}
              }`;
    case "map":
      return `Map<${generateTypeInternal(
        type.keys,
        collected,
        typeNameMapping,
        usedTypes
      )}, ${generateTypeInternal(
        type.values,
        collected,
        typeNameMapping,
        usedTypes
      )}>`;
    case "record":
      return `Record<${generateTypeInternal(
        type.keys,
        collected,
        typeNameMapping,
        usedTypes
      )}, ${generateTypeInternal(
        type.values,
        collected,
        typeNameMapping,
        usedTypes
      )}>`;
    case "union":
      return type.types
        .map(
          (subtype) =>
            `(${generateTypeInternal(
              subtype,
              collected,
              typeNameMapping,
              usedTypes
            )})`
        )
        .join(" | ");
    case "intersection":
      return type.types
        .map(
          (subtype) =>
            `(${generateTypeInternal(
              subtype,
              collected,
              typeNameMapping,
              usedTypes
            )})`
        )
        .join(" & ");
    case "function":
      return `(...params: any[]) => (${generateTypeInternal(
        type.returnType,
        collected,
        typeNameMapping,
        usedTypes
      )})`;
    case "promise":
      return `Promise<${generateTypeInternal(
        type.type,
        collected,
        typeNameMapping,
        usedTypes
      )}>`;
    case "name": {
      usedTypes.add(type.name);
      let name = safeTypeName(type.name, typeNameMapping);
      if (type.args.length > 0) {
        name += "<";
        for (let i = 0; i < type.args.length; i++) {
          if (i > 0) {
            name += ",";
          }
          const arg = type.args[i]!;
          name += generateTypeInternal(
            arg,
            collected,
            typeNameMapping,
            usedTypes
          );
        }
        name += ">";
      }
      return name;
    }
    default:
      throw assertNever(type);
  }
}
