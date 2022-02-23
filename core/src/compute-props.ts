import path from "path";
import { localEndpoints } from "../api";
import { generateDefaultProps } from "./generators/generate-default-props";
import { generateInvocation } from "./generators/generate-invocation";
import { generateTypeDeclarations } from "./generators/generate-type-declarations";
import { ComponentAnalyzer } from "./plugins/framework";

export async function computeProps({
  rootDirPath,
  relativeFilePath,
  componentName,
  componentAnalyzer,
}: {
  rootDirPath: string;
  relativeFilePath: string;
  componentName: string;
  componentAnalyzer: ComponentAnalyzer;
}): Promise<localEndpoints.PreviewSources> {
  let filePath = path.join(rootDirPath, relativeFilePath);
  const result = componentAnalyzer(filePath, componentName);
  const typeDeclarationsSource = generateTypeDeclarations(
    componentName,
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
