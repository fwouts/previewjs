import path from "path";
import { ComponentAnalyzer } from "../analysis/analyzer-plugin";
import { PreviewSources } from "../api/endpoints";
import { generateDefaultProps } from "../types/generators/generate-default-props";
import { generateInvocation } from "../types/generators/generate-invocation";
import { generateTypeDeclarations } from "../types/generators/generate-type-declarations";

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
}): Promise<PreviewSources> {
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
