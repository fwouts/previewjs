import { LocalApi } from "@previewjs/app/client/src/api/local";
import { WebApi } from "@previewjs/app/client/src/api/web";
import { PersistedStateController } from "@previewjs/app/client/src/PersistedStateController";
import { PreviewState } from "@previewjs/app/client/src/PreviewState";
import { makeAutoObservable } from "mobx";

export class AppState {
  readonly preview: PreviewState;

  private readonly persistedStateController: PersistedStateController;

  constructor(localApi: LocalApi, webApi: WebApi) {
    makeAutoObservable(this);
    this.persistedStateController = new PersistedStateController(localApi);
    this.preview = new PreviewState(
      localApi,
      webApi,
      this.persistedStateController
    );
  }

  async start() {
    await this.preview.start();
  }

  async stop() {
    this.preview.stop();
  }
}
