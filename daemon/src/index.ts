import type { PreviewServer } from "@previewjs/core";
import { load, type WorkspaceWorker } from "@previewjs/loader/runner";
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
    exitHook((signal) => {
      // Note: The bracketed tag is required for VS Code and IntelliJ to detect exit.
      process.stdout.write(
        `[exit] Preview.js daemon shutting down with signal: ${signal}`
      );
      try {
        unlinkSync(lockFilePath);
      } catch {
        // It's possible for several processes to try unlinking at the same time.
        // For example, a new daemon that will replace this one.
        // Ignore.
      }
    });
  } catch {
    // eslint-disable-next-line no-console
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
}

export interface DaemonStartOptions {
  loaderInstallDir: string;
  onServerStartModuleName: string;
  versionCode: string;
  port: number;
}

export async function startDaemon({
  loaderInstallDir,
  onServerStartModuleName,
  versionCode,
  port,
}: DaemonStartOptions) {
  const previewjs = await load({
    installDir: loaderInstallDir,
    workerFilePath: path.join(__dirname, "worker.js"),
    onServerStartModuleName,
  });
  const logger = previewjs.logger;

  const clients = new Set<string>();
  const workspaces: Record<string, WorkspaceWorker> = {};
  const previewServers: Record<string, PreviewServer> = {};
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
      logger.warn(
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
            logger.error(`404 in endpoint ${req.url}:`);
            logger.error(e);
            sendPlainTextError(res, 404, e.message || "Not Found");
          } else {
            logger.error(`500 in endpoint ${req.url}:`);
            logger.error(e);
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

  endpoint<HealthyRequest, HealthyResponse>("/previewjs/healthy", async () => ({
    healthy: true,
  }));

  endpoint<KillRequest, KillResponse>("/previewjs/kill", async () => {
    setTimeout(() => {
      logger.info("Seppuku was requested. Bye bye.");
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
          logger.info(
            `No clients are alive after ${AUTOMATIC_SHUTDOWN_DELAY_SECONDS}s. Shutting down.`
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
      // eslint-disable-next-line
      console.error("STARTING");
      const workspace = await previewjs.getWorkspace({
        versionCode,
        absoluteFilePath: transformAbsoluteFilePath(req.absoluteFilePath),
      });
      // eslint-disable-next-line
      console.error(workspace?.rootDir);
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
        rootDir: workspace.rootDir,
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

  endpoint<CrawlFileRequest, CrawlFileResponse>(
    "/crawl-file",
    async ({ workspaceId, absoluteFilePath }) => {
      const workspace = workspaces[workspaceId];
      if (!workspace) {
        throw new NotFoundError();
      }
      return workspace.crawlFiles([
        path
          .relative(
            workspace.rootDir,
            transformAbsoluteFilePath(absoluteFilePath)
          )
          .replace(/\\/g, "/"),
      ]);
    }
  );

  endpoint<StartPreviewRequest, StartPreviewResponse>(
    "/previews/start",
    async (req) => {
      const workspace = workspaces[req.workspaceId];
      if (!workspace) {
        throw new NotFoundError();
      }
      const previewServer =
        previewServers[req.workspaceId] || (await workspace.startServer());
      previewServers[req.workspaceId] = previewServer;
      return {
        url: previewServer.url(),
      };
    }
  );
  endpoint<StopPreviewRequest, StopPreviewResponse>(
    "/previews/stop",
    async (req) => {
      const previewServer = previewServers[req.workspaceId];
      if (!previewServer) {
        throw new NotFoundError();
      }
      await previewServer.stop();
      delete previewServers[req.workspaceId];
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

  // Note: The bracketed tag is required for VS Code and IntelliJ to detect ready state.
  process.stdout.write(
    `[ready] Preview.js daemon server is now running at http://localhost:${port}\n`
  );
}
