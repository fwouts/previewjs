import {
  CollectedTypes,
  generateTypeDeclarations,
} from "@previewjs/type-analyzer";

export function generatePropsTypeDeclarations(
  typeName: string,
  types: CollectedTypes
) {
  return `declare let properties: ${typeName.split(":")[1]};

declare function fn<T>(name: string, returnValue?: T): () => T;

${generateTypeDeclarations([typeName], types)}
`;
}
