import { declareEndpoint } from "@previewjs/core/api/endpoint";

export const AnalyzeFileEndpoint = declareEndpoint<
  {
    relativeFilePath: string;
  },
  {
    components: Component[];
  }
>("analyze-file");

export const AnalyzeProjectEndpoint = declareEndpoint<
  {
    forceRefresh?: boolean;
  },
  {
    components: Record<
      string,
      Array<{
        componentName: string;
        exported: boolean;
      }>
    >;
    cached: boolean;
  }
>("analyze-project");

export const ComputePropsEndpoint = declareEndpoint<
  {
    relativeFilePath: string;
    componentName: string;
  },
  PreviewSources | null
>("compute-props");

export interface Component {
  relativeFilePath: string;
  key: string;
  label: string;
  componentName: string;
  exported: boolean;
}

export interface PreviewSources {
  typeDeclarationsSource: string;
  defaultPropsSource: string;
  defaultInvocationSource: string;
}
