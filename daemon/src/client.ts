import { exclusivePromiseRunner } from "exclusive-promises";
import http from "http";
import type {
  CheckPreviewStatusRequest,
  CheckPreviewStatusResponse,
  CrawlFileRequest,
  CrawlFileResponse,
  StartPreviewRequest,
  StartPreviewResponse,
  StopPreviewRequest,
  StopPreviewResponse,
  UpdatePendingFileRequest,
  UpdatePendingFileResponse,
} from "./api.js";
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
              } catch {
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
    crawlFile: makeRPC("/crawl-file"),
    startPreview: makeRPC("/previews/start"),
    checkPreviewStatus: makeRPC("/previews/status"),
    stopPreview: makeRPC("/previews/stop"),
    updatePendingFile: makeRPC("/pending-files/update"),
  };
  return client;
}

export interface Client {
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
