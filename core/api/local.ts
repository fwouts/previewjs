import { declareEndpoint } from "./endpoint";
import { PersistedState } from "./persisted-state";

export const GetInfoEndpoint = declareEndpoint<
  void,
  {
    appInfo: {
      platform: string;
      version: string;
    };
  }
>("get-info");

export const GetStateEndpoint = declareEndpoint<void, PersistedState>(
  "get-state"
);

export const UpdateStateEndpoint = declareEndpoint<
  Partial<PersistedState>,
  PersistedState
>("update-state");
