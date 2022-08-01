import http from "http";
import type {
  AnalyzeFileRequest,
  AnalyzeFileResponse,
  DisposeWorkspaceRequest,
  DisposeWorkspaceResponse,
  GetWorkspaceRequest,
  GetWorkspaceResponse,
  StartPreviewRequest,
  StartPreviewResponse,
  StopPreviewRequest,
  StopPreviewResponse,
  UpdatePendingFileRequest,
  UpdatePendingFileResponse,
} from "./api";
import { locking } from "./locking";
export * from "./api";

export function createClient(baseUrl: string): Client {
  async function makeRequest<Req, Res>(
    path: `/${string}`,
    request: Req
  ): Promise<Res> {
    return locking<Res>(async () => {
      console.error("Request for:", path);
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
          },
          (res) => {
            res.on("data", (data) => {
              responseData += data;
            });
            res.on("end", () => {
              console.error("Received response:", responseData);
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
        console.error("Sending request:", postData);
      });
    });
  }

  function makeEndpoint<Req, Res>(path: `/${string}`) {
    return (request: Req): Promise<Res> => makeRequest(path, request);
  }

  return {
    waitForReady: async () => {
      // TODO: Set timeout.
      loop: while (true) {
        try {
          await makeRequest("/health", {});
          break loop;
        } catch (e) {
          // Ignore.
          console.warn(e);
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
        }
      }
    },
    getWorkspace: makeEndpoint("/workspaces/get"),
    disposeWorkspace: makeEndpoint("/workspaces/dispose"),
    analyzeFile: makeEndpoint("/analyze/file"),
    startPreview: makeEndpoint("/previews/start"),
    stopPreview: makeEndpoint("/previews/stop"),
    updatePendingFile: makeEndpoint("/pending-files/update"),
  };
}

export interface Client {
  waitForReady(): Promise<void>;
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
