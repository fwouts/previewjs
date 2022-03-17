import { LocalApi } from "@previewjs/app/client/src/api/local";
import { WebApi } from "@previewjs/app/client/src/api/web";
import { PersistedStateController } from "@previewjs/app/client/src/PersistedStateController";
import { PreviewState } from "@previewjs/app/client/src/PreviewState";
import { makeAutoObservable } from "mobx";
import { LicenseModalState } from "../license-modal/LicenseModalState";
import { LicenseState } from "./LicenseState";
import { ProState } from "./ProState";

export class AppState {
  readonly preview: PreviewState;
  readonly license: LicenseState;
  readonly licenseModal: LicenseModalState;
  readonly pro: ProState;

  private readonly persistedStateController: PersistedStateController;

  constructor(localApi: LocalApi, webApi: WebApi) {
    makeAutoObservable(this);
    this.persistedStateController = new PersistedStateController(localApi);
    this.preview = new PreviewState(
      localApi,
      webApi,
      this.persistedStateController,
      {
        onFileChanged: async (filePath) => {
          await this.pro.onFileChanged(filePath);
        },
      }
    );
    this.license = new LicenseState(webApi, this.persistedStateController);
    this.licenseModal = new LicenseModalState(webApi, this.license);
    this.pro = new ProState(localApi, this.preview.iframeController);
  }

  async start() {
    await this.preview.start();
    await this.license.start();
    await this.pro.start();
  }

  async stop() {
    this.preview.stop();
    this.pro.stop();
  }
}
