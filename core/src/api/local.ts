import { declareEndpoint } from "./endpoint";
import { PersistedState } from "./persisted-state";

export const GetInfo = declareEndpoint<
  void,
  {
    appInfo: {
      platform: string;
      version: string;
    };
  }
>("get-info");

export const GetState = declareEndpoint<void, PersistedState>("get-state");

export const UpdateState = declareEndpoint<
  Partial<PersistedState>,
  PersistedState
>("update-state");

export const ComputeProps = declareEndpoint<
  {
    filePath: string;
    componentName: string;
  },
  PreviewSources | null
>("compute-props");

export interface PreviewSources {
  typeDeclarationsSource: string;
  defaultPropsSource: string;
  defaultInvocationSource: string;
}
