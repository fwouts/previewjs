import type { ResponseOf, RPCs } from "@previewjs/api";
import axios from "axios";
import { makeAutoObservable, runInAction } from "mobx";
import type { PersistedStateController } from "../../state/PersistedStateController";
import "../../window";

export class UpdateBannerState {
  private checkVersionResponse: CheckVersionResponse | null = null;

  constructor(
    private readonly persistedStateController: PersistedStateController
  ) {
    makeAutoObservable(this);
  }

  async start(appInfo: ResponseOf<typeof RPCs.GetInfo>["appInfo"]) {
    try {
      const request: CheckVersionRequest = {
        appInfo,
      };
      const axiosResponse = await axios.post(
        "https://previewjs.com/api/versions/check",
        request
      );
      const checkVersionResponse = axiosResponse.data as CheckVersionResponse;
      runInAction(() => {
        this.checkVersionResponse = checkVersionResponse;
      });
    } catch (e) {
      console.warn(e);
      // Don't crash. This is an optional check.
    }
  }

  get update(): UpdateAvailable | null {
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

type CheckVersionRequest = {
  appInfo: VersionInfo;
};

interface VersionInfo {
  platform: string;
  version: string;
}

interface CheckVersionResponse {
  update: UpdateAvailability;
}

type UpdateAvailability =
  | {
      available: false;
      url?: string;
    }
  | UpdateAvailable;

interface UpdateAvailable {
  available: true;
  required: boolean;
  bannerMessage: string;
  url: string;
}
