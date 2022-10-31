import { Api, PersistedState, RPCs } from "@previewjs/api";
import { makeAutoObservable, runInAction } from "mobx";

export class PersistedStateController {
  private persistedState: PersistedState | null = null;

  constructor(private readonly rpcApi: Api) {
    makeAutoObservable(this);
  }

  async start() {
    const persistedState = await this.rpcApi.request(RPCs.GetState);
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
    await this.rpcApi.request(RPCs.UpdateState, stateUpdate);
  }
}
