import prettier from "prettier";
import parserTypescript from "prettier/parser-typescript.js";
import type { CollectedTypes } from "./definitions";
import { generateTypeInternal } from "./generate-type";
import { safeTypeName } from "./type-names";

export function generateTypeDeclarations(
  names: string[],
  collected: CollectedTypes,
  typeNameMapping: {
    [name: string]: string;
  } = {}
) {
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
            params += ` = ${generateTypeInternal(
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
      )}${params} = ${generateTypeInternal(
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
