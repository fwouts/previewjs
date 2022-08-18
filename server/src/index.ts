import type { Preview, Workspace } from "@previewjs/core";
import { load } from "@previewjs/loader/runner";
import crypto from "crypto";
import http from "http";
import isWsl from "is-wsl";
import net from "net";
import path from "path";
import type {
  AnalyzeFileRequest,
  AnalyzeFileResponse,
  DisposeWorkspaceRequest,
  DisposeWorkspaceResponse,
  GetWorkspaceRequest,
  GetWorkspaceResponse,
  InfoRequest,
  InfoResponse,
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
import { createClient } from "./client";
import { waitForSuccessfulPromise } from "./wait-for-successful-promise";

const AUTOMATIC_SHUTDOWN_DELAY_MILLIS = 5000;

export interface ServerStartOptions {
  loaderInstallDir: string;
  packageName: string;
  versionCode: string;
  port: number;
}

export async function ensureServerRunning(options: ServerStartOptions) {
  const alreadyRunning = await isServerAlreadyRunning(options);
  if (alreadyRunning) {
    console.log(
      `Preview.js daemon server is already running on port ${options.port}.`
    );
    return;
  }
  await startServer(options);
}

async function isServerAlreadyRunning({
  loaderInstallDir,
  packageName,
  versionCode,
  port,
}: ServerStartOptions): Promise<boolean> {
  const client = createClient(`http://localhost:${port}`);
  let alreadyRunningInfo: InfoResponse | null = null;
  try {
    alreadyRunningInfo = await client.info();
  } catch (e) {
    // This is fine, it just means the server isn't running.
  }
  if (alreadyRunningInfo) {
    if (
      alreadyRunningInfo.loaderInstallDir === loaderInstallDir &&
      alreadyRunningInfo.packageName === packageName &&
      alreadyRunningInfo.versionCode === versionCode
    ) {
      // The server is already running with the same config.
      return true;
    }
    console.warn(
      "Server is already running with different config. Killing it."
    );
    await client.kill();
    await waitForSuccessfulPromise(() => isPortAvailable(port));
  }
  return false;
}

function isPortAvailable(port: number) {
  return new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);

    server.listen(
      {
        port,
      },
      () => {
        server.close(() => {
          resolve();
        });
      }
    );
  });
}

async function startServer({
  loaderInstallDir,
  packageName,
  versionCode,
  port,
}: ServerStartOptions) {
  const previewjs = await load({
    installDir: loaderInstallDir,
    packageName,
  });

  const clients = new Set<string>();
  const workspaces: Record<string, Workspace> = {};
  const previews: Record<string, Preview> = {};
  const endpoints: Record<string, (req: any) => Promise<any>> = {};

  const app = http.createServer((req, res) => {
    if (!req.url) {
      throw new Error(`Received request without URL`);
    }
    if (req.url === "/health") {
      return sendJsonResponse(res, {
        ready: true,
      });
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

  endpoint<InfoRequest, InfoResponse>("/previewjs/info", async () => ({
    loaderInstallDir,
    packageName,
    versionCode,
  }));

  endpoint<InfoRequest, KillResponse>("/previewjs/kill", async () => {
    setTimeout(() => {
      console.log("Shutting down server because seppuku was requested.");
      process.exit(0);
    }, 0);
    return {};
  });

  let shutdownTimer: NodeJS.Timeout | null = null;
  endpoint<UpdateClientStatusRequest, UpdateClientStatusResponse>(
    "/previewjs/clients/status",
    async (req) => {
      if (req.alive) {
        clients.add(req.clientId);
      } else {
        clients.delete(req.clientId);
      }
      if (shutdownTimer) {
        clearTimeout(shutdownTimer);
      }
      shutdownTimer = setTimeout(() => {
        if (clients.size === 0) {
          console.log("Shutting down server because no clients are alive.");
          process.exit(0);
        }
      }, AUTOMATIC_SHUTDOWN_DELAY_MILLIS);
      return {};
    }
  );

  endpoint<GetWorkspaceRequest, GetWorkspaceResponse>(
    "/workspaces/get",
    async (req) => {
      const workspace = await previewjs.getWorkspace({
        versionCode,
        logLevel: "info",
        absoluteFilePath: transformAbsoluteFilePath(req.absoluteFilePath),
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
        existingWorkspaceId || crypto.randomBytes(16).toString("hex");
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
          [transformAbsoluteFilePath(absoluteFilePath)]
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
      await previewjs.updateFileInMemory(
        transformAbsoluteFilePath(req.absoluteFilePath),
        req.utf8Content
      );
      return {};
    }
  );

  const server = await new Promise<http.Server | null>((resolve, reject) => {
    const server = app
      .listen(port, () => {
        resolve(server);
      })
      .on("error", async (e: any) => {
        if (e.code === "EADDRINUSE") {
          if (
            await isServerAlreadyRunning({
              loaderInstallDir,
              packageName,
              versionCode,
              port,
            })
          ) {
            resolve(null);
            return;
          }
        }
        reject(e);
      });
  });

  if (server) {
    console.log(
      `Preview.js daemon server is now running on http://localhost:${port}`
    );
  } else {
    console.log(
      `Another Preview.js daemon server spun up concurrently on ${port}. All good.`
    );
  }
}

function transformAbsoluteFilePath(absoluteFilePath: string) {
  if (!isWsl) {
    return absoluteFilePath;
  }
  if (absoluteFilePath.match(/^[a-z]:.*$/i)) {
    // This is a Windows path, which needs to be converted to Linux format inside WSL.
    return `/mnt/${absoluteFilePath
      .substring(0, 1)
      .toLowerCase()}/${absoluteFilePath.substring(3).replace(/\\/g, "/")}`;
  }
  // This is already a Linux path.
  return absoluteFilePath;
}
