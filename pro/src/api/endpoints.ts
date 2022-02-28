import { declareEndpoint } from "@previewjs/core/api";

export const AnalyzeFileEndpoint = declareEndpoint<
  {
    filePath: string;
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
    filePath: string;
    componentName: string;
  },
  PreviewSources | null
>("compute-props");

export interface Component {
  filePath: string;
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
