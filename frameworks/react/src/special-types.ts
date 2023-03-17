import { arrayType, functionType, NODE_TYPE } from "@previewjs/type-analyzer";
import type { ValueType } from "@previewjs/type-analyzer";

export const REACT_SPECIAL_TYPES: Record<string, ValueType> = {
  Component: NODE_TYPE,
  ComponentClass: functionType(NODE_TYPE),
  FunctionComponent: functionType(NODE_TYPE),
  ReactElement: NODE_TYPE,
  ReactNode: NODE_TYPE,
  ReactNodeArray: arrayType(NODE_TYPE),
  ReactPortal: NODE_TYPE,
};
