import { arrayType, functionType, NODE_TYPE } from "@previewjs/type-analyzer";
import type { ValueType } from "@previewjs/type-analyzer";

export const PREACT_SPECIAL_TYPES: Record<string, ValueType> = {
  Component: NODE_TYPE,
  ComponentClass: functionType(NODE_TYPE),
  ComponentChildren: NODE_TYPE,
  FunctionComponent: functionType(NODE_TYPE),
  FunctionalComponent: functionType(NODE_TYPE),
  PreactElement: NODE_TYPE,
  PreactNode: NODE_TYPE,
  PreactNodeArray: arrayType(NODE_TYPE),
  PreactPortal: NODE_TYPE,
};
