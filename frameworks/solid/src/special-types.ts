import { functionType, NODE_TYPE, ValueType } from "@previewjs/type-analyzer";

export const SOLID_SPECIAL_TYPES: Record<string, ValueType> = {
  Component: functionType(NODE_TYPE),
  Element: NODE_TYPE,
  FunctionElement: NODE_TYPE,
  Node: NODE_TYPE,
};
