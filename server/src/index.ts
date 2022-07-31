import type { Preview, Workspace } from "@previewjs/core";
import { load } from "@previewjs/loader/runner";
import crypto from "crypto";
import http from "http";
import path from "path";
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

export async function runServer({
  loaderInstallDir,
  packageName,
  versionCode,
  port,
}: {
  loaderInstallDir: string;
  packageName: string;
  versionCode: string;
  port: number;
}) {
  const previewjs = await load({
    installDir: loaderInstallDir,
    packageName,
  });

  const workspaces: Record<string, Workspace> = {};
  const previews: Record<string, Preview> = {};
  const endpoints: Record<string, (req: any) => Promise<any>> = {};

  const app = http.createServer((req, res) => {
    if (!req.url) {
      throw new Error(`Received request without URL`);
    }
    if (req.url === "/health") {
      return sendJsonResponse(res, { ready: true });
    }
    if (req.method !== "POST") {
      return sendPlainTextError(res, 400, `Unsupported method: ${req.method}`);
    }
    const endpoint = endpoints[req.url];
    if (!endpoint) {
      return sendPlainTextError(res, 400, `No endpoint for path: ${req.url}`);
    }
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", function () {
      let requestBody: unknown;
      try {
        requestBody = JSON.parse(data);
      } catch (e: any) {
        return sendPlainTextError(res, 400, `Invalid JSON: ${e.message}`);
      }
      endpoint(requestBody)
        .then((responseBody) => sendJsonResponse(res, responseBody))
        .catch((e) => {
          if (e instanceof NotFoundError) {
            console.error(`404 in endpoint ${path}:`);
            console.error(e);
            sendPlainTextError(res, 404, e.message || "Not Found");
          } else {
            console.error(`500 in endpoint ${path}:`);
            console.error(e);
            sendPlainTextError(res, 500, e.message || "Internal Error");
          }
        });
    });
  });

  function sendJsonResponse(res: http.ServerResponse, body: unknown) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write(JSON.stringify(body));
    res.end();
  }

  function sendPlainTextError(
    res: http.ServerResponse,
    statusCode: number,
    message: string
  ) {
    res.writeHead(statusCode, { "Content-Type": "text/plain" });
    res.end(message);
  }

  function endpoint<Request, Response>(
    path: string,
    f: (req: Request) => Promise<Response>
  ) {
    endpoints[path] = f;
  }

  class NotFoundError extends Error {}

  endpoint<GetWorkspaceRequest, GetWorkspaceResponse>(
    "/workspaces/get",
    async (req) => {
      const workspace = await previewjs.getWorkspace({
        versionCode,
        logLevel: "info",
        absoluteFilePath: req.absoluteFilePath,
      });
      if (!workspace) {
        return {
          workspaceId: null,
        };
      }
      const existingWorkspaceId = Object.entries(workspaces)
        .filter(([, value]) => value === workspace)
        ?.map(([key]) => key)[0];
      const workspaceId =
        existingWorkspaceId || crypto.randomBytes(16).toString("base64url");
      workspaces[workspaceId] = workspace;
      return {
        workspaceId,
      };
    }
  );

  endpoint<DisposeWorkspaceRequest, DisposeWorkspaceResponse>(
    "/workspaces/dispose",
    async (req) => {
      const workspaceId = req.workspaceId;
      const workspace = workspaces[workspaceId];
      if (!workspace) {
        throw new NotFoundError();
      }
      await workspace.dispose();
      delete workspaces[workspaceId];
      return {};
    }
  );

  endpoint<AnalyzeFileRequest, AnalyzeFileResponse>(
    "/analyze/file",
    async ({ workspaceId, absoluteFilePath, options }) => {
      const workspace = workspaces[workspaceId];
      if (!workspace) {
        throw new NotFoundError();
      }
      const components = (
        await workspace.frameworkPlugin.detectComponents(
          workspace.typeAnalyzer,
          [absoluteFilePath]
        )
      )
        .map((c) => {
          return c.offsets
            .filter(([start, end]) => {
              if (options?.offset === undefined) {
                return true;
              }
              return options.offset >= start && options.offset <= end;
            })
            .map(([start]) => ({
              componentName: c.name,
              exported: c.exported,
              offset: start,
              componentId: previewjs.core.generateComponentId({
                currentFilePath: path.relative(
                  workspace.rootDirPath,
                  c.absoluteFilePath
                ),
                name: c.name,
              }),
            }));
        })
        .flat();
      return { components };
    }
  );

  endpoint<StartPreviewRequest, StartPreviewResponse>(
    "/previews/start",
    async (req) => {
      const workspace = workspaces[req.workspaceId];
      if (!workspace) {
        throw new NotFoundError();
      }
      const preview =
        previews[req.workspaceId] || (await workspace.preview.start());
      previews[req.workspaceId] = preview;
      return {
        url: preview.url(),
      };
    }
  );

  endpoint<StopPreviewRequest, StopPreviewResponse>(
    "/previews/stop",
    async (req) => {
      const preview = previews[req.workspaceId];
      if (!preview) {
        throw new NotFoundError();
      }
      await preview.stop({
        onceUnused: true,
      });
      delete previews[req.workspaceId];
      return {};
    }
  );

  endpoint<UpdatePendingFileRequest, UpdatePendingFileResponse>(
    "/pending-files/update",
    async (req) => {
      await previewjs.updateFileInMemory(req.absoluteFilePath, req.utf8Content);
      return {};
    }
  );

  const server = await new Promise<http.Server>((resolve, reject) => {
    const server = app
      .listen(port, () => {
        resolve(server);
      })
      .on("error", (e) => {
        reject(e);
      });
  });

  console.error(
    `Preview.js controller API is running on http://localhost:${port}`
  );

  return () =>
    new Promise<void>((resolve, reject) =>
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      })
    );
}
