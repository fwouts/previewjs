import assertNever from "assert-never";
import fs from "fs-extra";
import { Worker } from "node:worker_threads";
import path from "path";
import createLogger, { type Logger } from "pino";
import prettyLogger from "pino-pretty";
import type { LogLevel } from "./index.js";
import { installDependenciesIfRequired, loadModules } from "./modules.js";
import {
  type CrawlFileRequest,
  type FromWorkerMessage,
  type StartServerRequest,
  type StopServerRequest,
  type ToWorkerMessage,
  type WorkerData,
  type WorkerRequest,
  type WorkerResponse,
  type WorkerResponseType,
} from "./worker-api.js";

const validLogLevels = new Set<unknown>(["debug", "info", "error", "silent"]);

export type WorkspaceWorker = {
  rootDir: string;
  updateFile(absoluteFilePath: string, text: string | null): void;
  crawlFiles(
    absoluteFilePaths: string[]
  ): Promise<WorkerResponseType<CrawlFileRequest>>;
  startServer(options?: { port?: number }): Promise<{
    url: () => string;
    stop: () => Promise<void>;
  }>;
  dispose(): Promise<void>;
};

export async function load({
  installDir,
  workerFilePath,
  onServerStartModuleName,
}: {
  installDir: string;
  workerFilePath: string;
  onServerStartModuleName?: string;
}) {
  let globalLogLevel = process.env[
    "PREVIEWJS_LOG_LEVEL"
  ]?.toLowerCase() as LogLevel;
  if (!validLogLevels.has(globalLogLevel)) {
    globalLogLevel = "info";
  }
  const prettyLoggerStream = prettyLogger({
    colorize: true,
    destination: process.stdout,
  });
  const globalLogger = createLogger(
    { level: globalLogLevel },
    prettyLoggerStream
  );
  await installDependenciesIfRequired(installDir);
  const { core, vfs, frameworkPlugins } = await loadModules({
    logger: globalLogger,
    installDir,
  });
  const memoryReader = vfs.createMemoryReader();
  // TODO: Clear memory reader when file saved.
  const workers: {
    [rootDir: string]:
      | (Promise<WorkspaceWorker> & { promised: WorkspaceWorker })
      | null;
  } = {};

  return {
    core,
    logger: globalLogger,
    updateFileInMemory(absoluteFilePath: string, text: string | null) {
      memoryReader.updateFile(absoluteFilePath, text);
      for (const worker of Object.values(workers)) {
        worker?.promised.updateFile(absoluteFilePath, text);
      }
    },
    async getWorkspace({
      versionCode,
      absoluteFilePath,
    }: {
      versionCode: string;
      absoluteFilePath: string;
    }) {
      const rootDir = core.findWorkspaceRoot(absoluteFilePath);
      if (!rootDir) {
        globalLogger.info(
          `No workspace root detected from ${absoluteFilePath}`
        );
        return null;
      }
      // TODO: Load a proper configuration file containing the desired log level.
      // Pending https://twitter.com/fwouts/status/1658288168238735361
      let logLevel = globalLogLevel;
      let logger = globalLogger;
      if (await fs.pathExists(path.join(rootDir, "previewjs-debug"))) {
        // Show debug logs for this workspace.
        logLevel = "debug";
        logger = createLogger({ level: logLevel }, prettyLoggerStream);
      }
      let existingWorker = workers[rootDir];
      if (existingWorker !== undefined) {
        return existingWorker;
      }
      const frameworkPluginName = await core.findCompatiblePlugin(
        logger,
        rootDir,
        frameworkPlugins
      );
      if (!frameworkPluginName) {
        // Note: This caches the incompatibility of a workspace (i.e. caching null), which
        // would be problematic especially when package.json is updated to a compatible
        // package version.
        // TODO: Find a smarter approach, perhaps checking last-modified time of package.json and node_modules.
        workers[rootDir] = null;
        return null;
      }
      // Note: we check again here because of race conditions while awaiting above.
      existingWorker = workers[rootDir];
      if (existingWorker !== undefined) {
        return existingWorker;
      }
      return initializeWorker(
        logger,
        logLevel,
        versionCode,
        workerFilePath,
        rootDir,
        frameworkPluginName
      );
    },
    async dispose() {
      const promises: Array<Promise<void>> = [];
      for (const worker of Object.values(workers)) {
        if (!worker) {
          continue;
        }
        promises.push(worker.promised.dispose());
      }
      await Promise.all(promises);
    },
  };

  // Note: this should remain a sync function to prevent any race conditions.
  function initializeWorker(
    logger: Logger,
    logLevel: LogLevel,
    versionCode: string,
    workerFilePath: string,
    rootDir: string,
    frameworkPluginName: string
  ) {
    // eslint-disable-next-line
    console.error("WORKER PATH", workerFilePath);
    const worker = new Worker(workerFilePath, {
      workerData: {
        logLevel,
        versionCode,
        installDir,
        rootDir,
        inMemorySnapshot: memoryReader.snapshot(),
        frameworkPluginName,
        onServerStartModuleName,
      } satisfies WorkerData,
    });
    const pendingResponses: Record<
      number /* request ID */,
      {
        resolve: (response: WorkerResponse) => void;
        reject: (error: any) => void;
      }
    > = {};
    let nextRequestId = 0;
    let resolveWorkerReady: () => void;
    let rejectWorkerReady: ((error: any) => void) | null;
    const workerReadyPromise = new Promise<void>((resolve, reject) => {
      resolveWorkerReady = resolve;
      rejectWorkerReady = reject;
    });
    worker.on("message", (message: FromWorkerMessage) => {
      switch (message.kind) {
        case "ready":
          resolveWorkerReady();
          rejectWorkerReady = null;
          break;
        case "crash":
          logger.error(message.message);
          delete workers[rootDir];
          rejectWorkerReady?.(new Error(message.message));
          worker.terminate().catch((e) => logger.error(e));
          break;
        case "response": {
          const pending = pendingResponses[message.requestId];
          switch (message.data.kind) {
            case "success":
              pending?.resolve(message.data.response);
              break;
            case "error":
              pending?.reject(new Error(message.data.message));
              break;
            default:
              throw assertNever(message.data);
          }
          delete pendingResponses[message.requestId];
          break;
        }
        default:
          throw assertNever(message);
      }
    });
    const send = (message: ToWorkerMessage) => {
      worker.postMessage(message);
    };
    const request = async <Request extends WorkerRequest>(request: Request) => {
      const requestId = nextRequestId++;
      const promise = new Promise<WorkerResponseType<typeof request>>(
        (resolve, reject) => {
          pendingResponses[requestId] = {
            resolve: resolve as (response: WorkerResponse) => void,
            reject,
          };
        }
      );
      send({
        kind: "request",
        requestId,
        request,
      });
      return promise;
    };
    const workspaceWorker: WorkspaceWorker = {
      rootDir,
      updateFile: (absoluteFilePath, text) => {
        send({
          kind: "in-memory-file-update",
          absoluteFilePath,
          text,
        });
      },
      crawlFiles: (absoluteFilePaths) => {
        return request<CrawlFileRequest>({
          kind: "crawl-files",
          body: {
            absoluteFilePaths,
          },
        });
      },
      startServer: async (options = {}) => {
        const { url, serverId } = await request<StartServerRequest>({
          kind: "start-server",
          body: options,
        });
        return {
          url: () => url,
          stop: async () => {
            await request<StopServerRequest>({
              kind: "stop-server",
              body: { serverId },
            });
          },
        };
      },
      dispose: async () => {
        delete workers[rootDir];
        await worker.terminate();
      },
    };
    // @ts-ignore
    const workspaceWorkerPromise: Promise<WorkspaceWorker> & {
      promised: WorkspaceWorker;
    } = workerReadyPromise.then(() => workspaceWorker);
    workspaceWorkerPromise.promised = workspaceWorker;
    workers[rootDir] = workspaceWorkerPromise;
    return workspaceWorkerPromise;
  }
}
