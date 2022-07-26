import {
  CollectedTypes,
  generateTypeDeclarations,
} from "@previewjs/type-analyzer";

export function generatePropsTypeDeclarations(
  typeName: string,
  types: CollectedTypes
) {
  return `declare let properties: ${typeName.split(":")[1]};

${generateTypeDeclarations([typeName], types)}
`;
}
