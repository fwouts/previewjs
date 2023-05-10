import type { ComponentAnalysis } from "@previewjs/core";
import {
  CollectedTypes,
  NODE_TYPE,
  TypeResolver,
  UNKNOWN_TYPE,
  ValueType,
  intersectionType,
  objectType,
  optionalType,
} from "@previewjs/type-analyzer";
import ts from "typescript";

export function analyzeVueComponentFromTemplate(
  resolver: TypeResolver,
  virtualVueTsAbsoluteFilePath: string
): ComponentAnalysis {
  const sourceFile = resolver.sourceFile(virtualVueTsAbsoluteFilePath);
  let propsType: ValueType = UNKNOWN_TYPE;
  let types: CollectedTypes = {};
  let slots: string[] = [];
  for (const statement of sourceFile?.statements || []) {
    if (ts.isTypeAliasDeclaration(statement)) {
      if (statement.name.text === "PJS_Props") {
        const type = resolver.checker.getTypeAtLocation(statement);
        const defineComponentProps = resolver.resolveType(type);
        propsType = defineComponentProps.type;
        types = defineComponentProps.collected;
      } else if (statement.name.text === "PJS_Slots") {
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
  }
  return {
    propsType: intersectionType([
      propsType,
      objectType(
        Object.fromEntries(
          slots.map((slotName) => [`slot:${slotName}`, optionalType(NODE_TYPE)])
        )
      ),
    ]),
    types,
  };
}
