import { generateComponentId, RPCs } from "@previewjs/api";
import type { Preview, Workspace } from "@previewjs/core";
import { load } from "@previewjs/loader/runner";
import crypto from "crypto";
import exitHook from "exit-hook";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import http from "http";
import isWsl from "is-wsl";
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
} from "./api.js";
import { createClient } from "./client.js";

const AUTOMATIC_SHUTDOWN_DELAY_SECONDS = 30;

const lockFilePath = process.env.PREVIEWJS_LOCK_FILE;
if (lockFilePath) {
  if (existsSync(lockFilePath)) {
    const pid = parseInt(readFileSync(lockFilePath, "utf8"));
    try {
      // Test if PID is still running. This will fail if not.
      process.kill(pid, 0);
    } catch {
      // Previous process ended prematurely (e.g. hardware crash).
      try {
        unlinkSync(lockFilePath);
      } catch {
        // It's possible for several processes to try unlinking at the same time.
        // For example, a running daemon that is exiting at the same time.
        // Ignore.
      }
    }
  }
  try {
    writeFileSync(lockFilePath, process.pid.toString(10), {
      flag: "wx",
    });
    exitHook(() => {
      console.log("[exit] Preview.js daemon shutting down");
      try {
        unlinkSync(lockFilePath);
      } catch {
        // It's possible for several processes to try unlinking at the same time.
        // For example, a new daemon that will replace this one.
        // Ignore.
      }
    });
  } catch {
    console.error(
      `Unable to obtain lock: ${lockFilePath}\nYou can delete this file manually if you wish to override the lock.`
    );
    process.exit(1);
  }
}

const logFilePath = process.env.PREVIEWJS_LOG_FILE;

if (logFilePath) {
  writeFileSync(logFilePath, "", "utf8");
  const wrapProcessStreamWriter = (
    oldWriter: typeof process.stdout.write
  ): typeof process.stdout.write => {
    return (buffer, callbackOrBufferEncoding) => {
      appendFileSync(logFilePath, "" + buffer, "utf8");
      if (!callbackOrBufferEncoding) {
        return oldWriter(buffer);
      } else if (typeof callbackOrBufferEncoding === "string") {
        return oldWriter(buffer, callbackOrBufferEncoding);
      } else {
        return oldWriter(buffer, callbackOrBufferEncoding);
      }
    };
  };
  process.stderr.write = wrapProcessStreamWriter(
    process.stderr.write.bind(process.stderr)
  );
  process.stdout.write = wrapProcessStreamWriter(
    process.stdout.write.bind(process.stdout)
  );
  process.on("uncaughtException", (e) => {
    console.error("Encountered an uncaught exception", e);
    process.exit(1);
  });
  process.on("unhandledRejection", (e) => {
    console.error("Encountered an unhandled promise", e);
    process.exit(1);
  });
}

export interface DaemonStartOptions {
  loaderInstallDir: string;
  packageName: string;
  versionCode: string;
  port: number;
}

export async function startDaemon({
  loaderInstallDir,
  packageName,
  versionCode,
  port,
}: DaemonStartOptions) {
  const previewjs = await load({
    installDir: loaderInstallDir,
    packageName,
  });

  const clients = new Set<string>();
  const workspaces: Record<string, Workspace> = {};
  const previews: Record<string, Preview> = {};
  const endpoints: Record<string, (req: any) => Promise<any>> = {};
  let wslRoot: string | null = null;

  function transformAbsoluteFilePath(absoluteFilePath: string) {
    if (!isWsl) {
      return absoluteFilePath;
    }
    if (absoluteFilePath.match(/^[a-z]:.*$/i)) {
      if (!wslRoot) {
        wslRoot = detectWslRoot();
      }
      // This is a Windows path, which needs to be converted to Linux format inside WSL.
      return `${wslRoot}/${absoluteFilePath
        .substring(0, 1)
        .toLowerCase()}/${absoluteFilePath.substring(3).replace(/\\/g, "/")}`;
    }
    // This is already a Linux path.
    return absoluteFilePath;
  }

  function detectWslRoot() {
    const wslConfPath = "/etc/wsl.conf";
    const defaultRoot = "/mnt";
    try {
      if (!existsSync(wslConfPath)) {
        return defaultRoot;
      }
      const configText = readFileSync(wslConfPath, "utf8");
      const match = configText.match(/root\s*=\s*(.*)/);
      if (!match) {
        return defaultRoot;
      }
      const detectedRoot = match[1]!.trim();
      if (detectedRoot.endsWith("/")) {
        return detectedRoot.substring(0, detectedRoot.length - 1);
      } else {
        return detectedRoot;
      }
    } catch (e) {
      console.warn(
        `Unable to read WSL config, assuming default root: ${defaultRoot}`
      );
      return defaultRoot;
    }
  }

  const app = http.createServer((req, res) => {
    if (req.headers["origin"]) {
      return sendPlainTextError(res, 400, `Unsupported browser access`);
    }
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
            console.error(`404 in endpoint ${req.url}:`);
            console.error(e);
            sendPlainTextError(res, 404, e.message || "Not Found");
          } else {
            console.error(`500 in endpoint ${req.url}:`);
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
      console.log("Seppuku was requested. Bye bye.");
      process.exit(0);
    }, 1000);
    return {
      pid: process.pid,
    };
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
          console.log(
            `No clients are alive after ${AUTOMATIC_SHUTDOWN_DELAY_SECONDS}s.`
          );
          process.exit(0);
        }
      }, AUTOMATIC_SHUTDOWN_DELAY_SECONDS * 1000);
      return {};
    }
  );

  endpoint<GetWorkspaceRequest, GetWorkspaceResponse>(
    "/workspaces/get",
    async (req) => {
      const workspace = await previewjs.getWorkspace({
        versionCode,
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
        rootDirPath: workspace.rootDirPath,
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
    async ({ workspaceId, absoluteFilePath }) => {
      const workspace = workspaces[workspaceId];
      if (!workspace) {
        throw new NotFoundError();
      }
      const { components } = await workspace.localRpc(RPCs.DetectComponents, {
        filePaths: [
          path
            .relative(
              workspace.rootDirPath,
              transformAbsoluteFilePath(absoluteFilePath)
            )
            .replace(/\\/g, "/"),
        ],
      });
      const results: Array<{
        componentName: string;
        start: number;
        end: number;
        componentId: string;
      }> = [];
      for (const [filePath, fileComponents] of Object.entries(components)) {
        for (const component of fileComponents) {
          results.push({
            componentName: component.name,
            componentId: generateComponentId({
              filePath,
              name: component.name,
            }),
            start: component.start,
            end: component.end,
          });
        }
      }
      return { components: results };
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

  await new Promise<void>((resolve, reject) => {
    app.listen(port, resolve).on("error", async (e: any) => {
      if (e.code !== "EADDRINUSE") {
        return reject(e);
      }
      try {
        // There's another daemon running already on the same port.
        // Attempt to kill it and try again. This can happen for example
        // when upgrading from one version to another of Preview.js.
        const client = createClient(`http://localhost:${port}`);
        const { pid } = await client.kill();
        // Wait for daemon to be killed.
        let oldDaemonDead = false;
        for (let i = 0; !oldDaemonDead && i < 10; i++) {
          try {
            // Test if PID is still running. This will fail if not.
            process.kill(pid, 0);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch {
            oldDaemonDead = true;
            app.listen(port, resolve).on("error", reject);
          }
        }
        if (!oldDaemonDead) {
          reject(
            new Error(
              `Unable to kill old daemon server running on port ${port}`
            )
          );
        }
      } catch (e) {
        reject(e);
      }
    });
  });

  console.log(
    `[ready] Preview.js daemon server is now running at http://localhost:${port}`
  );
}
