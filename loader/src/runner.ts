import assertNever from "assert-never";
import fs from "fs-extra";
import { fork } from "node:child_process";
import path from "path";
import createLogger, { type Logger } from "pino";
import prettyLogger from "pino-pretty";
import type { LogLevel } from "./index.js";
import { installDependenciesIfRequired, loadModules } from "./modules.js";
import {
  type CrawlFileRequest,
  type FromWorkerMessage,
  type ToWorkerMessage,
  type WorkerRequest,
  type WorkerResponse,
  type WorkerResponseType,
} from "./worker-api.js";

const validLogLevels = new Set<unknown>(["debug", "info", "error", "silent"]);

export type WorkspaceWrapper = {
  rootDir: string;
  updateFile(absoluteFilePath: string, text: string | null): Promise<void>;
  crawlFiles(
    absoluteFilePaths: string[]
  ): Promise<WorkerResponseType<CrawlFileRequest>>;
  startServer(options?: { port?: number }): Promise<{
    url: () => string;
    stop: () => Promise<void>;
  }>;
  dispose(): Promise<void>;
};

export type WorkspaceWorker = {
  request: <Request extends WorkerRequest>(
    request: Request
  ) => Promise<WorkerResponseType<Request>>;
  kill: () => void;
};

const CLEANUP_INTERVAL_MILLIS = 1000;
const KILL_WORKER_AFTER_IDLE_MILLIS = 60_000;

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
      | (Promise<WorkspaceWorker> & {
          lastAccess: number;
          ready: boolean;
          promised: WorkspaceWorker;
        })
      | null;
  } = {};
  const wrappers: {
    [rootDir: string]: WorkspaceWrapper | null;
  } = {};
  const activeServerWorkerRootDirs = new Set<string>();

  setInterval(() => {
    let lastAccess = Math.max(
      ...Object.values(workers).map((w) => w?.lastAccess || 0)
    );
    for (const [rootDir, worker] of Object.entries(workers)) {
      if (
        // Keep workers that aren't ready yet around.
        !worker?.ready ||
        // Keep workers that have been accessed in the last minute.
        worker.lastAccess > Date.now() - KILL_WORKER_AFTER_IDLE_MILLIS ||
        // Keep workers that have an active server.
        activeServerWorkerRootDirs.has(rootDir) ||
        // Keep the last accessed worker around.
        worker.lastAccess === lastAccess
      ) {
        continue;
      }
      worker.promised.kill();
    }
  }, CLEANUP_INTERVAL_MILLIS);

  return {
    core,
    logger: globalLogger,
    async updateFileInMemory(absoluteFilePath: string, text: string | null) {
      memoryReader.updateFile(absoluteFilePath, text);
      await Promise.all(
        Object.values(wrappers).map((wrapper) =>
          wrapper?.updateFile(absoluteFilePath, text)
        )
      );
    },
    async getWorkspace({
      versionCode,
      absoluteFilePath,
    }: {
      versionCode: string;
      absoluteFilePath: string;
    }): Promise<WorkspaceWrapper | null> {
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
      let existingWrapper = wrappers[rootDir];
      if (existingWrapper !== undefined) {
        return existingWrapper;
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
        wrappers[rootDir] = null;
        return null;
      }
      // Note: we check again here because of race conditions while awaiting above.
      existingWrapper = wrappers[rootDir];
      if (existingWrapper !== undefined) {
        return existingWrapper;
      }

      const getOrStartWorker = () =>
        ensureWorkerRunning(
          logger,
          logLevel,
          versionCode,
          workerFilePath,
          rootDir,
          frameworkPluginName
        );

      return (wrappers[rootDir] = {
        rootDir,
        updateFile: async (absoluteFilePath, text) => {
          const worker = await workers[rootDir];
          await worker?.request({
            kind: "update-in-memory-file",
            body: {
              absoluteFilePath,
              text,
            },
          });
        },
        crawlFiles: async (absoluteFilePaths) => {
          const worker = await getOrStartWorker();
          return await worker.request({
            kind: "crawl-files",
            body: {
              absoluteFilePaths,
            },
          });
        },
        startServer: async (options = {}) => {
          const worker = await getOrStartWorker();
          activeServerWorkerRootDirs.add(rootDir);
          const { url, serverId } = await worker.request({
            kind: "start-server",
            body: options,
          });
          return {
            url: () => url,
            stop: async () => {
              await worker.request({
                kind: "stop-server",
                body: { serverId },
              });
              activeServerWorkerRootDirs.delete(rootDir);
            },
          };
        },
        dispose: async () => {
          activeServerWorkerRootDirs.delete(rootDir);
          const worker = await workers[rootDir];
          worker?.kill();
          delete wrappers[rootDir];
        },
      });
    },
    async dispose() {
      const promises: Array<Promise<void>> = [];
      for (const wrapper of Object.values(wrappers)) {
        if (!wrapper) {
          continue;
        }
        promises.push(wrapper.dispose());
      }
      await Promise.all(promises);
    },
  };

  // Note: this should remain a sync function to prevent any race conditions.
  function ensureWorkerRunning(
    logger: Logger,
    logLevel: LogLevel,
    versionCode: string,
    workerFilePath: string,
    rootDir: string,
    frameworkPluginName: string
  ) {
    const existingWorker = workers[rootDir];
    if (existingWorker) {
      existingWorker.lastAccess = Date.now();
      return existingWorker;
    }
    const worker = fork(workerFilePath, {
      stdio: "pipe",
    });
    worker.stdout?.pipe(prettyLoggerStream);
    worker.stderr?.pipe(prettyLoggerStream);
    const killWorker = () => {
      delete workers[rootDir];
      worker.kill();
    };
    worker.on("error", (error) => {
      logger.error(error);
      killWorker();
    });
    worker.on("exit", () => {
      // Note: we should double check that there isn't a race condition if we
      // re-create the worker.
      delete workers[rootDir];
    });
    const send = (message: ToWorkerMessage) => worker.send(message);
    send({
      kind: "init",
      data: {
        logLevel,
        versionCode,
        installDir,
        rootDir,
        inMemorySnapshot: memoryReader.snapshot(),
        frameworkPluginName,
        onServerStartModuleName,
      },
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
          worker.kill();
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
      request,
      kill: killWorker,
    };
    // @ts-ignore
    const workspaceWorkerPromise: Promise<WorkspaceWorker> & {
      lastAccess: number;
      ready: boolean;
      promised: WorkspaceWorker;
    } = workerReadyPromise.then(() => {
      workspaceWorkerPromise.ready = true;
      return workspaceWorker;
    });
    workspaceWorkerPromise.lastAccess = Date.now();
    workspaceWorkerPromise.ready = false;
    workspaceWorkerPromise.promised = workspaceWorker;
    workers[rootDir] = workspaceWorkerPromise;
    return workspaceWorkerPromise;
  }
}
