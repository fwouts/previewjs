import type { SerializableValue } from "@previewjs/serializable-values";
import type { CollectedTypes, ValueType } from "@previewjs/type-analyzer";
import type { FrameworkPluginInfo } from "./api.js";
import type { RPC } from "./rpc.js";

export const GetInfo: RPC<
  Record<string, never>,
  {
    frameworkPlugin: FrameworkPluginInfo;
  }
> = {
  path: "info",
};

export const Analyze: RPC<
  {
    previewableIds: string[];
  },
  AnalyzeResponse
> = {
  path: "analyze",
};

export type AnalyzeResponse = {
  previewables: Array<AnalyzedComponent | AnalyzedStory>;
  types: CollectedTypes;
};

export type AnalyzedComponent = Component & {
  kind: "component";
  props: ValueType;
};

export type AnalyzedStory = Story & {
  kind: "story";
  props: ValueType;
  args: StoryArgs | null;
};

export const CrawlFiles: RPC<
  {
    filePaths?: string[];
    forceRefresh?: boolean;
  },
  CrawlFilesResponse
> = {
  path: "crawl-files",
};

export type CrawlFilesResponse = {
  components: Component[];
  stories: Story[];
};

export type Component = {
  id: string;
  sourcePosition: FileSourcePosition;
  exported: boolean;
};

export type Story = {
  id: string;
  sourcePosition: FileSourcePosition;
  associatedComponentId: string | null;
};

export type StoryArgs = {
  sourcePosition: FileSourcePosition;
  value: SerializableValue;
};

export type FileSourcePosition = {
  start: number;
  end: number;
};
