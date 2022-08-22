import type { CollectedTypes, ValueType } from "@previewjs/type-analyzer";
import type { Endpoint } from "./endpoint";
import type { PersistedState } from "./persisted-state";

export const GetInfo: Endpoint<
  void,
  {
    appInfo: {
      platform: string;
      version: string;
    };
  }
> = {
  path: "get-info",
};

export const GetState: Endpoint<void, PersistedState> = {
  path: "get-state",
};

export const UpdateState: Endpoint<Partial<PersistedState>, PersistedState> = {
  path: "update-state",
};

export const ComputeProps: Endpoint<
  {
    filePath: string;
    componentName: string;
  },
  ComputePropsResponse
> = {
  path: "compute-props",
};

export type ComputePropsResponse = {
  types: {
    props: ValueType;
    all: CollectedTypes;
  };
};
