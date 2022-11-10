import type { ComponentAnalysis } from "@previewjs/core";
import {
  CollectedTypes,
  dereferenceType,
  EMPTY_OBJECT_TYPE,
  maybeOptionalType,
  objectType,
  stripUnusedTypes,
  TypeResolver,
  UNKNOWN_TYPE,
  ValueType,
} from "@previewjs/type-analyzer";
import ts from "typescript";

export function analyzePreactComponent(
  typeResolver: TypeResolver,
  absoluteFilePath: string,
  componentName: string,
  signature: ts.Signature
) {
  const sourceFile = typeResolver.sourceFile(absoluteFilePath);
  let propTypes: ts.Expression | null = null;
  if (sourceFile) {
    propTypes = detectPropTypes(sourceFile, componentName);
  }
  const resolved = computePropsType(typeResolver, signature, propTypes);
  return {
    propsType: resolved.type,
    types: { ...resolved.collected },
  };
}
