import type { SerializableValue } from "@previewjs/serializable-values";
import type { CollectedTypes, ValueType } from "@previewjs/type-analyzer";
import type { RPC } from "./rpc";

export const ComputeProps: RPC<
  {
    previewableIds: string[];
  },
  ComputePropsResponse
> = {
  path: "compute-props",
};

export type ComputePropsResponse = {
  props: {
    [componentId: string]: ValueType;
  };
  args: {
    [storyId: string]: StoryArgs | null;
  };
  types: CollectedTypes;
};

export const AnalyzeFile: RPC<
  {
    filePaths?: string[];
    forceRefresh?: boolean;
  },
  AnalyzeFileResponse
> = {
  path: "detect-previewables",
};

export type AnalyzeFileResponse = {
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
