import { LocalApi } from "@previewjs/app/client/src/api/local";
import { PreviewIframeController } from "@previewjs/core/controller";
import { AnalyzeFileEndpoint, Component } from "@previewjs/pro-api/endpoints";
import { makeAutoObservable, observable, runInAction } from "mobx";
import { SearchState } from "./SearchState";
import { ViewportState } from "./ViewportState";

const REFRESH_PERIOD_MILLIS = 5000;

export interface FileInfo {
  loading: boolean;
  filePath: string;
  components: Component[];
}

export class ProState {
  currentFile: FileInfo | null = null;
  search: SearchState | null = null;
  viewport = new ViewportState();

  private refreshFileInterval: NodeJS.Timer | null = null;
  private refreshingFile: Promise<void> | null = null;

  constructor(
    private readonly localApi: LocalApi,
    private readonly controller: PreviewIframeController
  ) {
    makeAutoObservable<
      ProState,
      // Note: private fields must be explicitly added here.
      "refreshFileInterval" | "refreshingFile"
    >(this, {
      refreshFileInterval: observable.ref,
      refreshingFile: observable.ref,
    });
  }

  async start() {
    this.refreshFileInterval = setInterval(() => {
      this.refreshFile().catch(console.error);
    }, REFRESH_PERIOD_MILLIS);
  }

  stop() {
    if (this.refreshFileInterval) {
      clearInterval(this.refreshFileInterval);
      this.refreshFileInterval = null;
    }
  }

  toggleSearch() {
    if (this.search) {
      this.search = null;
    } else {
      this.search = new SearchState(this.localApi);
    }
  }

  async onFileChanged(filePath: string | null) {
    if (!filePath) {
      runInAction(() => {
        this.currentFile = {
          loading: false,
          components: [],
          filePath: "",
        };
      });
    } else if (filePath !== this.currentFile?.filePath) {
      runInAction(() => {
        this.currentFile = {
          loading: true,
          filePath,
          components: [],
        };
      });
      this.controller.showLoading();
      await this.refreshFile(filePath);
    }
  }

  private async refreshFile(newRelativeFilePath?: string) {
    if (this.refreshingFile && !newRelativeFilePath) {
      return;
    }

    const promise = (async () => {
      const filePath = newRelativeFilePath || this.currentFile?.filePath;
      if (!filePath) {
        return;
      }
      const response = await this.localApi.request(AnalyzeFileEndpoint, {
        filePath,
      });
      if (!newRelativeFilePath && response.components.length === 0) {
        // It's likely a temporary syntax error.
        return;
      }
      if (!newRelativeFilePath && this.currentFile?.filePath !== filePath) {
        // The file changed in the meantime. Don't update.
        return;
      }
      runInAction(() => {
        this.currentFile = {
          loading: false,
          filePath,
          ...response,
        };
      });
    })();
    this.refreshingFile = promise;
    try {
      await promise;
    } finally {
      if (this.refreshingFile === promise) {
        this.refreshingFile = null;
      }
    }
  }
}
