import type { PreviewServer, Workspace } from "@previewjs/core";
import { load } from "@previewjs/loader/runner";
import { appendFileSync, writeFileSync } from "fs";
import http from "http";
import path from "path";
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
  loaderWorkerPath: string;
  onServerStartModuleName: string;
  versionCode: string;
  port: number;
}

export async function startDaemon({
  loaderInstallDir,
  loaderWorkerPath,
  onServerStartModuleName,
  versionCode,
  port,
}: DaemonStartOptions) {
  const parentProcessId = parseInt(
    process.env["PREVIEWJS_PARENT_PROCESS_PID"] || "0"
  );
  if (!parentProcessId) {
    throw new Error(
      "Missing environment variable: PREVIEWJS_PARENT_PROCESS_PID"
    );
  }

  // Kill the daemon if the parent process dies.
  setInterval(() => {
    try {
      process.kill(parentProcessId, 0);
      // Parent process is still alive, see https://stackoverflow.com/a/21296291.
    } catch {
      process.stdout.write(
        `[exit] Parent process with PID ${parentProcessId} exited. Daemon exiting.\n`
      );
      process.exit(0);
    }
  }, 1000);

  const previewjs = await load({
    installDir: loaderInstallDir.replace(/\//g, path.sep),
    workerFilePath: loaderWorkerPath,
    onServerStartModuleName,
  });
  const logger = previewjs.logger;

  const previewServers: Record<string, PreviewServer> = {};
  const endpoints: Record<string, (req: any) => Promise<any>> = {};

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

  const inWorkspace = <T>(
    absoluteFilePath: string,
    run: (workspace: Workspace | null) => Promise<T>
  ) =>
    previewjs.inWorkspace({
      versionCode,
      absoluteFilePath,
      run,
    });

  endpoint<CrawlFileRequest, CrawlFileResponse>(
    "/crawl-file",
    async ({ absoluteFilePath }) =>
      inWorkspace<CrawlFileResponse>(absoluteFilePath, async (workspace) => {
        if (!workspace) {
          return { rootDir: null, previewables: [] };
        }
        const { components, stories } = await workspace.crawlFiles([
          path
            .relative(workspace.rootDir, absoluteFilePath)
            .replace(/\\/g, "/"),
        ]);
        return {
          rootDir: workspace.rootDir,
          previewables: [...components, ...stories].map((c) => ({
            id: c.id,
            start: c.sourcePosition.start,
            end: c.sourcePosition.end,
          })),
        };
      })
  );

  endpoint<StartPreviewRequest, StartPreviewResponse>(
    "/previews/start",
    async ({ rootDir, port, clientPort }) =>
      inWorkspace<StartPreviewResponse>(rootDir, async (workspace) => {
        if (workspace?.rootDir !== rootDir) {
          throw new NotFoundError();
        }
        let previewServer = previewServers[rootDir];
        if (!previewServer) {
          previewServer = previewServers[rootDir] = await workspace.startServer(
            {
              port,
              clientPort,
              onStop: () => {
                delete previewServers[rootDir];
              },
            }
          );
        }
        return {
          url: `http://localhost:${previewServer.port}`,
        };
      })
  );

  endpoint<CheckPreviewStatusRequest, CheckPreviewStatusResponse>(
    "/previews/status",
    async (req) => {
      return {
        running: Boolean(previewServers[req.rootDir]),
      };
    }
  );

  endpoint<StopPreviewRequest, StopPreviewResponse>(
    "/previews/stop",
    async (req) => {
      const previewServer = previewServers[req.rootDir];
      await previewServer?.stop();
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

  await new Promise<void>((resolve, reject) => {
    app.listen(port, resolve).on("error", async (e: any) => {
      reject(e);
    });
  });

  // Note: The bracketed tag is required for VS Code and IntelliJ to detect ready state.
  process.stdout.write(
    `[ready] Preview.js daemon server is now running at http://localhost:${port}\n`
  );
}
