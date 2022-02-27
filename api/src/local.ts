import { Endpoint } from "./endpoint";
import { PersistedState } from "./persisted-state";

export const GetInfo: Endpoint<
  void,
  {
    appInfo: {
      platform: string;
      version: string;
    };
  }
> = "get-info";

export const GetState: Endpoint<void, PersistedState> = "get-state";

export const UpdateState: Endpoint<
  Partial<PersistedState>,
  PersistedState
> = "update-state";

export const ComputeProps: Endpoint<
  {
    filePath: string;
    componentName: string;
  },
  PreviewSources | null
> = "compute-props";

export interface PreviewSources {
  typeDeclarationsSource: string;
  defaultPropsSource: string;
  defaultInvocationSource: string;
}
