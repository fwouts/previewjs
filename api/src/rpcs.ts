import type { SerializableValue } from "@previewjs/serializable-values";
import type { CollectedTypes, ValueType } from "@previewjs/type-analyzer";
import type { RPC } from "./rpc";

export const ComputeProps: RPC<
  {
    componentIds: string[];
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
    [storyComponentId: string]: StoryArgs | null;
  };
  types: CollectedTypes;
};

export const DetectComponents: RPC<
  {
    filePaths?: string[];
    forceRefresh?: boolean;
  },
  DetectComponentsResponse
> = {
  path: "detect-components",
};

export type DetectComponentsResponse = {
  components: Component[];
  stories: Story[];
};

export type Component = {
  componentId: string;
  sourcePosition: FileSourcePosition;
  exported: boolean;
};

export type Story = {
  componentId: string;
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
