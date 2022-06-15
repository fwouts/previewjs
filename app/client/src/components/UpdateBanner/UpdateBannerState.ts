import { localEndpoints, ResponseOf, webEndpoints } from "@previewjs/api";
import { makeAutoObservable, runInAction } from "mobx";
import { WebApi } from "../../api/web";
import { PersistedStateController } from "../../state/PersistedStateController";
import "../../window";

const REFRESH_PERIOD_MILLIS = 5000;

export class UpdateBannerState {
  private checkVersionResponse: webEndpoints.CheckVersionResponse | null = null;

  constructor(
    private readonly webApi: WebApi,
    private readonly persistedStateController: PersistedStateController
  ) {
    makeAutoObservable(this);
  }

  async start(appInfo: ResponseOf<typeof localEndpoints.GetInfo>["appInfo"]) {
    try {
      const checkVersionResponse = await this.webApi.request(
        webEndpoints.CheckVersion,
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

  get update() {
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
