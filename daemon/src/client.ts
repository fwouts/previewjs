import { exclusivePromiseRunner } from "exclusive-promises";
import { existsSync, readFileSync, unlinkSync } from "fs";
import http from "http";
import type {
  CheckPreviewStatusRequest,
  CheckPreviewStatusResponse,
  CrawlFileRequest,
  CrawlFileResponse,
  DisposeWorkspaceRequest,
  DisposeWorkspaceResponse,
  GetWorkspaceRequest,
  GetWorkspaceResponse,
  HealthyRequest,
  HealthyResponse,
  KillRequest,
  KillResponse,
  StartPreviewRequest,
  StartPreviewResponse,
  StopPreviewRequest,
  StopPreviewResponse,
  UpdateClientStatusRequest,
  UpdateClientStatusResponse,
  UpdatePendingFileRequest,
  UpdatePendingFileResponse,
} from "./api.js";
import { waitForTruePromise } from "./wait-for-successful-promise.js";
export * from "./api.js";

export function createClient(baseUrl: string): Client {
  const locking = exclusivePromiseRunner();

  async function makeRequest<Req, Res>(
    path: `/${string}`,
    request: Req
  ): Promise<Res> {
    return locking<Res>(async () => {
      return new Promise<Res>((resolve, reject) => {
        const url = new URL(baseUrl);
        const postData = JSON.stringify(request);
        let responseData = "";
        const req = http.request(
          {
            hostname: url.hostname,
            port: url.port,
            path,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(postData),
            },
            timeout: 5000,
          },
          (res) => {
            res.on("data", (data) => {
              responseData += data;
            });
            res.on("end", () => {
              try {
                const response = JSON.parse(responseData);
                resolve(response);
              } catch (e) {
                reject(
                  new Error(`Request to ${path} failed:\n${responseData}`)
                );
              }
            });
          }
        );
        req.on("error", (e) => {
          reject(e);
        });
        req.write(postData);
        req.end();
      });
    });
  }

  function makeRPC<Req, Res>(path: `/${string}`) {
    return (request: Req): Promise<Res> => makeRequest(path, request);
  }

  const client: Client = {
    waitForReady: async () => {
      await waitForTruePromise(() =>
        makeRequest<HealthyRequest, HealthyResponse>(
          "/previewjs/healthy",
          {}
        ).then(({ healthy }) => healthy)
      );
    },
    kill: () => makeRPC<KillRequest, KillResponse>("/previewjs/kill")({}),
    updateClientStatus: makeRPC("/previewjs/clients/status"),
    getWorkspace: makeRPC("/workspaces/get"),
    disposeWorkspace: makeRPC("/workspaces/dispose"),
    crawlFile: makeRPC("/crawl-file"),
    startPreview: makeRPC("/previews/start"),
    checkPreviewStatus: makeRPC("/previews/status"),
    stopPreview: makeRPC("/previews/stop"),
    updatePendingFile: makeRPC("/pending-files/update"),
  };
  return client;
}

export function destroyDaemon(lockFilePath: string) {
  if (existsSync(lockFilePath)) {
    const pid = parseInt(readFileSync(lockFilePath, "utf8"));
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The daemon was already dead.
    }
    unlinkSync(lockFilePath);
  }
}

export interface Client {
  waitForReady(): Promise<void>;
  kill(): Promise<KillResponse>;
  updateClientStatus(
    request: UpdateClientStatusRequest
  ): Promise<UpdateClientStatusResponse>;
  getWorkspace(request: GetWorkspaceRequest): Promise<GetWorkspaceResponse>;
  disposeWorkspace(
    request: DisposeWorkspaceRequest
  ): Promise<DisposeWorkspaceResponse>;
  crawlFile(request: CrawlFileRequest): Promise<CrawlFileResponse>;
  startPreview(request: StartPreviewRequest): Promise<StartPreviewResponse>;
  checkPreviewStatus(
    request: CheckPreviewStatusRequest
  ): Promise<CheckPreviewStatusResponse>;
  stopPreview(request: StopPreviewRequest): Promise<StopPreviewResponse>;
  updatePendingFile(
    request: UpdatePendingFileRequest
  ): Promise<UpdatePendingFileResponse>;
}
