import { exclusivePromiseRunner } from "exclusive-promises";
import http from "http";
import type {
  AnalyzeFileRequest,
  AnalyzeFileResponse,
  DisposeWorkspaceRequest,
  DisposeWorkspaceResponse,
  GetWorkspaceRequest,
  GetWorkspaceResponse,
  InfoRequest,
  InfoResponse,
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
import { waitForSuccessfulPromise } from "./wait-for-successful-promise";
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
      await waitForSuccessfulPromise(() => client.info());
    },
    info: () => makeRPC<InfoRequest, InfoResponse>("/previewjs/info")({}),
    kill: () => makeRPC<KillRequest, KillResponse>("/previewjs/kill")({}),
    updateClientStatus: makeRPC("/previewjs/clients/status"),
    getWorkspace: makeRPC("/workspaces/get"),
    disposeWorkspace: makeRPC("/workspaces/dispose"),
    analyzeFile: makeRPC("/analyze/file"),
    startPreview: makeRPC("/previews/start"),
    stopPreview: makeRPC("/previews/stop"),
    updatePendingFile: makeRPC("/pending-files/update"),
  };
  return client;
}

export interface Client {
  waitForReady(): Promise<void>;
  info(): Promise<InfoResponse>;
  kill(): Promise<KillResponse>;
  updateClientStatus(
    request: UpdateClientStatusRequest
  ): Promise<UpdateClientStatusResponse>;
  getWorkspace(request: GetWorkspaceRequest): Promise<GetWorkspaceResponse>;
  disposeWorkspace(
    request: DisposeWorkspaceRequest
  ): Promise<DisposeWorkspaceResponse>;
  analyzeFile(request: AnalyzeFileRequest): Promise<AnalyzeFileResponse>;
  startPreview(request: StartPreviewRequest): Promise<StartPreviewResponse>;
  stopPreview(request: StopPreviewRequest): Promise<StopPreviewResponse>;
  updatePendingFile(
    request: UpdatePendingFileRequest
  ): Promise<UpdatePendingFileResponse>;
}
