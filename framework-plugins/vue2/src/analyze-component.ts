import type { ComponentProps } from "@previewjs/component-detection-api";
import type {
  CollectedTypes,
  TypeResolver,
  ValueType,
} from "@previewjs/type-analyzer";
import {
  STRING_TYPE,
  UNKNOWN_TYPE,
  intersectionType,
  objectType,
} from "@previewjs/type-analyzer";
import ts from "typescript";

export function analyzeVueComponentFromTemplate(
  resolver: TypeResolver,
  virtualVueTsAbsoluteFilePath: string
): ComponentProps {
  const sourceFile = resolver.sourceFile(virtualVueTsAbsoluteFilePath);
  let props: ValueType = UNKNOWN_TYPE;
  let types: CollectedTypes = {};
  let slots: string[] = [];
  for (const statement of sourceFile?.statements || []) {
    if (ts.isTypeAliasDeclaration(statement)) {
      if (statement.name.text === "PJS_Props") {
        const type = resolver.checker.getTypeAtLocation(statement);
        const defineComponentProps = resolver.resolveType(type);
        props = defineComponentProps.type;
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
    props: intersectionType([
      props,
      objectType(
        Object.fromEntries(
          slots.map((slotName) => [`slot:${slotName}`, STRING_TYPE])
        )
      ),
    ]),
    types,
  };
}
