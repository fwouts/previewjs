import { localEndpoints } from "./api";
import { generateDefaultProps } from "./generators/generate-default-props";
import { generateInvocation } from "./generators/generate-invocation";
import { generateTypeDeclarations } from "./generators/generate-type-declarations";
import { Component } from "./plugins/framework";

export async function computeProps({
  rootDirPath,
  component,
}: {
  rootDirPath: string;
  component: Component;
}): Promise<localEndpoints.PreviewSources> {
  const result = await component.analyze();
  const typeDeclarationsSource = generateTypeDeclarations(
    component.name,
    result.propsType,
    result.providedArgs,
    result.types
  );
  const { source: defaultPropsSource, propKeys: defaultPropsKeys } =
    generateDefaultProps(result.propsType, result.types);
  const defaultInvocationSource = generateInvocation(
    result.propsType,
    new Set([...defaultPropsKeys, ...result.providedArgs]),
    result.types
  );
  return {
    typeDeclarationsSource,
    defaultPropsSource,
    defaultInvocationSource,
  };
}
