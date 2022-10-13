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
} from "./api";
import { waitForSuccessfulPromise } from "./wait-for-successful-promise";
export * from "./api";

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
              const response = JSON.parse(responseData);
              resolve(response);
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

  function makeEndpoint<Req, Res>(path: `/${string}`) {
    return (request: Req): Promise<Res> => makeRequest(path, request);
  }

  const client: Client = {
    waitForReady: async () => {
      await waitForSuccessfulPromise(() => client.info());
    },
    info: () => makeEndpoint<InfoRequest, InfoResponse>("/previewjs/info")({}),
    kill: () => makeEndpoint<KillRequest, KillResponse>("/previewjs/kill")({}),
    updateClientStatus: makeEndpoint("/previewjs/clients/status"),
    getWorkspace: makeEndpoint("/workspaces/get"),
    disposeWorkspace: makeEndpoint("/workspaces/dispose"),
    analyzeFile: makeEndpoint("/analyze/file"),
    startPreview: makeEndpoint("/previews/start"),
    stopPreview: makeEndpoint("/previews/stop"),
    updatePendingFile: makeEndpoint("/pending-files/update"),
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
