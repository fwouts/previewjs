import type { ComponentAnalysis } from "@previewjs/core";
import type {
  CollectedTypes,
  OptionalType,
  ValueType,
} from "@previewjs/type-analyzer";
import {
  STRING_TYPE,
  TypeResolver,
  intersectionType,
  maybeOptionalType,
  objectType,
} from "@previewjs/type-analyzer";
import ts from "typescript";

export function analyzeSvelteComponentFromSFC(
  resolver: TypeResolver,
  virtualSvelteTsAbsoluteFilePath: string
): ComponentAnalysis {
  const sourceFile = resolver.sourceFile(virtualSvelteTsAbsoluteFilePath);
  const propsTypeFields: Record<string, ValueType | OptionalType> = {};
  let collected: CollectedTypes = {};
  let slots: string[] = [];
  for (const statement of sourceFile?.statements || []) {
    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.find(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      ) &&
      statement.declarationList.flags ^ ts.NodeFlags.Const
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        const { type: fieldType, collected: fieldCollected } =
          resolver.resolveType(
            resolver.checker.getTypeAtLocation(declaration.name)
          );
        propsTypeFields[declaration.name.text] = maybeOptionalType(
          fieldType,
          !!declaration.initializer
        );
        collected = { ...collected, ...fieldCollected };
      }
    } else if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === "PJS_Slots"
    ) {
      const slotsType = resolver.checker.getTypeAtLocation(statement);
      const resolvedSlotsTypeName = resolver.resolveType(slotsType);
      if (resolvedSlotsTypeName.type.kind === "name") {
        const resolvedSlotsType =
          resolvedSlotsTypeName.collected[resolvedSlotsTypeName.type.name];
        if (resolvedSlotsType?.type.kind === "tuple") {
          for (const item of resolvedSlotsType.type.items) {
            if (item.kind === "literal" && typeof item.value === "string") {
              slots.push(item.value);
            }
          }
        }
      }
    }
  }
  return {
    propsType: intersectionType([
      objectType(propsTypeFields),
      objectType(
        Object.fromEntries(
          slots.map((slotName) => [`slot:${slotName}`, STRING_TYPE])
        )
      ),
    ]),
    types: collected,
  };
}
