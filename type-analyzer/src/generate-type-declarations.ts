import assertNever from "assert-never";
import prettier from "prettier";
import parserTypescript from "prettier/parser-typescript";
import type { CollectedTypes, ValueType } from "./definitions";

export function generateTypeDeclarations(
  names: string[],
  collected: CollectedTypes
) {
  const typeNameMapping: {
    [name: string]: string;
  } = {};
  const usedTypes = new Set(names);
  const declaredTypes = new Set<string>();

  let output = "";
  let generatedCount: number;
  do {
    generatedCount = 0;
    for (const typeName of [...usedTypes]) {
      if (declaredTypes.has(typeName)) {
        continue;
      }
      const type = collected[typeName];
      if (!type) {
        continue;
      }
      let params = "";
      if (Object.keys(type.parameters).length > 0) {
        params = "<";
        for (const [paramName, defaultType] of Object.entries(
          type.parameters
        )) {
          params += paramName;
          if (defaultType) {
            params += ` = ${generateTypeScriptType(
              defaultType,
              collected,
              typeNameMapping,
              usedTypes
            )}`;
          }
          params += ",";
        }
        params += ">";
      }
      output += `

type ${safeTypeName(
        typeName,
        typeNameMapping
      )}${params} = ${generateTypeScriptType(
        type.type,
        collected,
        typeNameMapping,
        usedTypes
      )}`;
      declaredTypes.add(typeName);
      generatedCount += 1;
    }
  } while (generatedCount > 0);

  return prettier
    .format(output, {
      parser: "typescript",
      plugins: [parserTypescript],
      filepath: "types.ts",
      trailingComma: "none",
    })
    .trim();
}

function generateTypeScriptType(
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
      return `Array<${generateTypeScriptType(
        type.items,
        collected,
        typeNameMapping,
        usedTypes
      )}>`;
    case "set":
      return `Set<${generateTypeScriptType(
        type.items,
        collected,
        typeNameMapping,
        usedTypes
      )}>`;
    case "tuple":
      return `[${type.items
        .map((item) =>
          generateTypeScriptType(item, collected, typeNameMapping, usedTypes)
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
                    resolvedPropType.kind === "optional" ||
                    resolvedPropType.kind === "any" ||
                    resolvedPropType.kind === "unknown";
                  return `["${propName.replace(/"/g, '\\"')}"]${
                    optional ? "?" : ""
                  }: ${generateTypeScriptType(
                    propType,
                    collected,
                    typeNameMapping,
                    usedTypes
                  )}`;
                })
                .join("\n")}
            }`;
    case "map":
      return `Map<${generateTypeScriptType(
        type.keys,
        collected,
        typeNameMapping,
        usedTypes
      )}, ${generateTypeScriptType(
        type.values,
        collected,
        typeNameMapping,
        usedTypes
      )}>`;
    case "record":
      return `Record<${generateTypeScriptType(
        type.keys,
        collected,
        typeNameMapping,
        usedTypes
      )}, ${generateTypeScriptType(
        type.values,
        collected,
        typeNameMapping,
        usedTypes
      )}>`;
    case "union":
      return type.types
        .map(
          (subtype) =>
            `(${generateTypeScriptType(
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
            `(${generateTypeScriptType(
              subtype,
              collected,
              typeNameMapping,
              usedTypes
            )})`
        )
        .join(" & ");
    case "function":
      return `(...params: any[]) => (${generateTypeScriptType(
        type.returnType,
        collected,
        typeNameMapping,
        usedTypes
      )})`;
    case "optional":
      return `${generateTypeScriptType(
        type.type,
        collected,
        typeNameMapping,
        usedTypes
      )} | undefined`;
    case "promise":
      return `Promise<${generateTypeScriptType(
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
          name += generateTypeScriptType(
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

function safeTypeName(
  fullTypeName: string,
  typeNameMapping: {
    [name: string]: string;
  }
) {
  const existingName = typeNameMapping[fullTypeName];
  if (existingName) {
    return existingName;
  }
  const typeName = fullTypeName.split(":")[1]!;
  if (!typeName) {
    // This is a generic type name.
    return fullTypeName;
  }
  let i = 1;
  const existingTypeNames = new Set(Object.values(typeNameMapping));
  while (existingTypeNames.has(numberedName(typeName, i))) {
    i++;
  }
  const result = numberedName(typeName, i);
  typeNameMapping[fullTypeName] = result;
  return result;
}

function numberedName(typeName: string, i: number) {
  return `${typeName}${i === 1 ? "" : `_${i}`}`;
}
