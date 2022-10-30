import { Api, localRPCs, ResponseOf, webRPCs } from "@previewjs/api";
import { makeAutoObservable, runInAction } from "mobx";
import type { PersistedStateController } from "../../state/PersistedStateController";
import "../../window";

export class UpdateBannerState {
  private checkVersionResponse: webRPCs.CheckVersionResponse | null = null;

  constructor(
    private readonly webApi: Api,
    private readonly persistedStateController: PersistedStateController
  ) {
    makeAutoObservable(this);
  }

  async start(appInfo: ResponseOf<typeof localRPCs.GetInfo>["appInfo"]) {
    try {
      const checkVersionResponse = await this.webApi.request(
        webRPCs.CheckVersion,
        {
          appInfo,
        }
      );
      runInAction(() => {
        this.checkVersionResponse = checkVersionResponse;
      });
    } catch (e) {
      console.warn(e);
      // Don't crash. This is an optional check.
    }
  }

  get update(): webRPCs.UpdateAvailable | null {
    const update = this.checkVersionResponse?.update;
    const persistedState = this.persistedStateController.state;
    if (!update?.available || !persistedState) {
      return null;
    }
    const dismissedAt = persistedState.updateDismissed?.timestamp;
    if (
      !update.required &&
      dismissedAt &&
      Date.now() < dismissedAt + 24 * 60 * 60 * 1000
    ) {
      return null;
    }
    return update;
  }

  onUpdateDismissed = async () => {
    await this.persistedStateController.update({
      updateDismissed: {
        timestamp: Date.now(),
      },
    });
  };
}
