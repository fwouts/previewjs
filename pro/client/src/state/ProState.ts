import { LocalApi } from "@previewjs/app/client/src/api/local";
import { PreviewIframeController } from "@previewjs/core/controller";
import {
  AnalyzeFileEndpoint,
  Component,
  ComputePropsEndpoint,
} from "@previewjs/pro-api/endpoints";
import { makeAutoObservable, observable, runInAction } from "mobx";

const REFRESH_PERIOD_MILLIS = 5000;

export interface FileInfo {
  loading: boolean;
  relativeFilePath: string;
  components: Component[];
}

export class ProState {
  currentFile: FileInfo | null = null;

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

  start() {
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

  async onFileChanged(relativeFilePath: string | null) {
    if (!relativeFilePath) {
      runInAction(() => {
        this.currentFile = {
          loading: false,
          components: [],
          relativeFilePath: "",
        };
      });
    } else if (relativeFilePath !== this.currentFile?.relativeFilePath) {
      runInAction(() => {
        this.currentFile = {
          loading: true,
          relativeFilePath,
          components: [],
        };
      });
      this.controller.showLoading();
      await this.refreshFile(relativeFilePath);
    }
  }

  async getComponentDetails({
    relativeFilePath,
    key,
  }: {
    relativeFilePath: string;
    key: string;
  }) {
    if (
      !this.currentFile ||
      this.currentFile.relativeFilePath !== relativeFilePath
    ) {
      throw new Error(
        `Unable to get component sources before file is analyzed.`
      );
    }
    const component = this.currentFile.components.find((c) => c.key === key);
    if (!component) {
      throw new Error(`No component found with key: ${key}`);
    }
    const sources = await this.localApi.request(ComputePropsEndpoint, {
      relativeFilePath: component.relativeFilePath,
      componentName: component.componentName,
    });
    return {
      relativeFilePath: component.relativeFilePath,
      componentName: component.componentName,
      defaultProps: sources?.defaultPropsSource || "{}",
      invocation:
        sources?.defaultInvocationSource ||
        `properties = {
        // foo: "bar"
        }`,
      typeDeclarations:
        sources?.typeDeclarationsSource || `declare let properties: any;`,
    };
  }

  private async refreshFile(newRelativeFilePath?: string) {
    if (this.refreshingFile && !newRelativeFilePath) {
      return;
    }

    const promise = (async () => {
      const relativeFilePath =
        newRelativeFilePath || this.currentFile?.relativeFilePath;
      if (!relativeFilePath) {
        return;
      }
      const response = await this.localApi.request(AnalyzeFileEndpoint, {
        relativeFilePath,
      });
      if (!newRelativeFilePath && response.components.length === 0) {
        // It's likely a temporary syntax error.
        return;
      }
      if (
        !newRelativeFilePath &&
        this.currentFile?.relativeFilePath !== relativeFilePath
      ) {
        // The file changed in the meantime. Don't update.
        return;
      }
      runInAction(() => {
        this.currentFile = {
          loading: false,
          relativeFilePath,
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
