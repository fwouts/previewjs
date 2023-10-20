import type { InMemoryFilesSnapshot } from "@previewjs/vfs";
import type { LogLevel } from ".";

export type WorkerData = {
  logLevel: LogLevel;
  versionCode: string;
  installDir: string;
  rootDir: string;
  inMemorySnapshot: InMemoryFilesSnapshot;
  frameworkPluginName: string;
  onServerStartModuleName?: string;
};

export type ToWorkerMessage =
  | {
      kind: "init";
      data: WorkerData;
    }
  | {
      kind: "in-memory-file-update";
      absoluteFilePath: string;
      text: string | null;
    }
  | {
      kind: "request";
      requestId: number;
      request: WorkerRequest;
    };

export type WorkerRequest =
  | CrawlFileRequest
  | StartServerRequest
  | StopServerRequest;

export type WorkerResponse = WorkerResponseType<WorkerRequest>;

export type CrawlFileRequest = WorkerRequestType<
  "crawl-files",
  {
    absoluteFilePaths: string[];
  },
  {
    previewables: Array<{
      start: number;
      end: number;
      id: string;
    }>;
  }
>;

export type StartServerRequest = WorkerRequestType<
  "start-server",
  {
    port?: number;
  },
  {
    serverId: number;
    url: string;
  }
>;

export type StopServerRequest = WorkerRequestType<
  "stop-server",
  {
    serverId: number;
  },
  Record<string, never>
>;

export type WorkerRequestType<Kind, Request, Response> = {
  kind: Kind;
  body: Request;
  __response__?: Response;
};

export type WorkerResponseType<Request> = Request extends {
  __response__?: infer Response;
}
  ? Response
  : never;

export type FromWorkerMessage =
  | {
      kind: "ready";
    }
  | {
      kind: "crash";
      message: string;
    }
  | {
      kind: "response";
      requestId: number;
      data:
        | {
            kind: "error";
            message: string;
          }
        | {
            kind: "success";
            response: WorkerResponse;
          };
    };
