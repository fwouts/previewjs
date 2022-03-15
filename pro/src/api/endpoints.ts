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
  filePath: string;
  key: string;
  type: "component" | "story";
  name: string;
  exported: boolean;
}
