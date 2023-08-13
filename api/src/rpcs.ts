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
    [storyComponentId: string]: SerializableValue;
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
  start: number;
  end: number;
  exported: boolean;
};

export type Story = {
  componentId: string;
  start: number;
  end: number;
  associatedComponentId: string | null;
};
