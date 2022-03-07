import { localEndpoints, PersistedState } from "@previewjs/api";
import { makeAutoObservable, runInAction } from "mobx";
import { LocalApi } from "./api/local";

export class PersistedStateController {
  private readonly localApi: LocalApi;
  private persistedState: PersistedState | null = null;

  constructor() {
    this.localApi = new LocalApi("/api/");
    makeAutoObservable(this);
  }

  async start() {
    const persistedState = await this.localApi.request(localEndpoints.GetState);
    runInAction(() => {
      this.persistedState = persistedState;
    });
  }

  get state() {
    return this.persistedState;
  }

  async update(stateUpdate: Partial<PersistedState>) {
    runInAction(() => {
      this.persistedState = {
        ...this.persistedState,
        ...stateUpdate,
      };
    });
    await this.localApi.request(localEndpoints.UpdateState, stateUpdate);
  }
}
