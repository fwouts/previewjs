import type { SerializableValue } from "@previewjs/serializable-values";
import type { CollectedTypes, ValueType } from "@previewjs/type-analyzer";
import type { RPC } from "./rpc";

export const ComputeProps: RPC<
  {
    filePath: string;
    componentName: string;
  },
  ComputePropsResponse
> = {
  path: "compute-props",
};

export type ComputePropsResponse = {
  component: Component;
  types: {
    props: ValueType;
    all: CollectedTypes;
  };
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
  info:
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
};
