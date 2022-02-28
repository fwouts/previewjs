import type { Endpoint } from "@previewjs/api";

export const AnalyzeFileEndpoint: Endpoint<
  {
    filePath: string;
  },
  {
    components: Component[];
  }
> = {
  path: "analyze-file",
};

export const AnalyzeProjectEndpoint: Endpoint<
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
> = {
  path: "analyze-project",
};

export const ComputePropsEndpoint: Endpoint<
  {
    filePath: string;
    componentName: string;
  },
  PreviewSources | null
> = {
  path: "compute-props",
};

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
