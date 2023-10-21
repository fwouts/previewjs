import type { InMemoryFilesSnapshot } from "@previewjs/vfs";
import type { LogLevel } from ".";

export type WorkerData = {
  logLevel: LogLevel;
  versionCode: string;
  installDir: string;
  rootDir: string;
  inMemorySnapshot: InMemoryFilesSnapshot;
  frameworkPluginName: string;
  port?: number;
  onServerStartModuleName?: string;
};

export type ToWorkerMessage =
  | {
      kind: "init";
      data: WorkerData;
    }
  | {
      kind: "request";
      requestId: number;
      request: WorkerRequest;
    };

export type WorkerRequest = UpdateInMemoryFileRequest;

export type WorkerResponse = WorkerResponseType<WorkerRequest>;

export type UpdateInMemoryFileRequest = WorkerRequestType<
  "update-in-memory-file",
  {
    absoluteFilePath: string;
    text: string | null;
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
      url: string;
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
