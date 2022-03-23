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

export interface Component {
  componentId: string;
  type: "component" | "story";
  name: string;
  exported: boolean;
}

export const AnalyzeProjectEndpoint: Endpoint<
  {
    forceRefresh?: boolean;
  },
  AnalyzeProjectResponse
> = {
  path: "analyze-project",
};

export type AnalyzeProjectResponse = {
  components: Record<
    string,
    Array<{
      componentName: string;
      exported: boolean;
    }>
  >;
  cached: boolean;
};
