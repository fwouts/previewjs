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
