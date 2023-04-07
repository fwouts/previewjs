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
  components: {
    [componentId: string]: {
      info: ComponentInfo;
      props: ValueType;
    };
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
  components: {
    [filePath: string]: Component[];
  };
};

export type Component = {
  name: string;
  start: number;
  end: number;
  info: ComponentInfo;
};

export type ComponentInfo =
  | {
      kind: "component";
      exported: boolean;
    }
  | {
      kind: "story";
      args: {
        start: number;
        end: number;
        value: SerializableValue;
      } | null;
      associatedComponent: {
        filePath: string;
        name: string;
      };
    };
