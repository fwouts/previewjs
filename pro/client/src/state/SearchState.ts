import { LocalApi } from "@previewjs/app/client/src/api/local";
import {
  AnalyzeProjectEndpoint,
  AnalyzeProjectResponse,
} from "@previewjs/pro-api/endpoints";
import { makeAutoObservable, runInAction } from "mobx";

export class SearchState {
  private state:
    | {
        kind: "loading";
      }
    | {
        kind: "ready";
        response: AnalyzeProjectResponse;
      }
    | {
        kind: "error";
        exception: unknown;
      } = {
    kind: "loading",
  };

  constructor(private readonly localApi: LocalApi) {
    makeAutoObservable(this);
    this.refresh(false);
  }

  async refresh(forceRefresh = true) {
    this.state = {
      kind: "loading",
    };
    try {
      const response = await this.localApi.request(AnalyzeProjectEndpoint, {
        forceRefresh,
      });
      runInAction(() => {
        this.state = {
          kind: "ready",
          response,
        };
      });
    } catch (e) {
      runInAction(() => {
        this.state = {
          kind: "error",
          exception: e,
        };
      });
    }
  }

  get status() {
    return this.state.kind;
  }

  get components() {
    if (this.state.kind !== "ready") {
      return [];
    }
    return Object.entries(this.state.response.components)
      .flatMap(([filePath, fileComponents]) =>
        fileComponents
          .filter((c) => c.exported)
          .map(({ componentName }) => ({
            name: componentName,
            filePath,
          }))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
