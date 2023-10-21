import type { Workspace } from "@previewjs/core";
import assertNever from "assert-never";
import fs from "fs-extra";
import { fork } from "node:child_process";
import path from "path";
import createLogger, { type Logger } from "pino";
import prettyLogger from "pino-pretty";
import type { LogLevel } from "./index.js";
import { installDependenciesIfRequired, loadModules } from "./modules.js";
import {
  type FromWorkerMessage,
  type ToWorkerMessage,
  type WorkerRequest,
  type WorkerResponse,
  type WorkerResponseType,
} from "./worker-api.js";

const validLogLevels = new Set<unknown>(["debug", "info", "error", "silent"]);

export type ServerWorker = {
  url: string;
  request: <Request extends WorkerRequest>(
    request: Request
  ) => Promise<WorkerResponseType<Request>>;
  kill: () => void;
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
  const fsReader = vfs.createFileSystemReader({
    watch: true,
  });
  fsReader.listeners.add({
    onChange(absoluteFilePath, info) {
      if (!info.virtual) {
        memoryReader.updateFile(absoluteFilePath, null);
      }
    },
  });
  const reader = vfs.createStackedReader([memoryReader, fsReader]);

  // Workspaces used for crawling files only.
  // We use a separate worker process when it comes to spinning up a server, so we can
  // cleanly reload node modules when a dependency is updated such as a Vite plugin.
  const workspaces: {
    [rootDir: string]: Promise<Workspace> | null;
  } = {};
  const serverWorkers: {
    [rootDir: string]: Promise<ServerWorker>;
  } = {};

  return {
    core,
    logger: globalLogger,
    async updateFileInMemory(absoluteFilePath: string, text: string | null) {
      memoryReader.updateFile(absoluteFilePath, text);
      await Promise.all(
        Object.values(serverWorkers).map((worker) =>
          worker?.then((worker) =>
            worker.request({
              kind: "update-in-memory-file",
              body: { absoluteFilePath, text },
            })
          )
        )
      );
    },
    async getWorkspace({
      versionCode,
      absoluteFilePath,
    }: {
      versionCode: string;
      absoluteFilePath: string;
    }): Promise<Workspace | null> {
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
      let existingWorkspace = workspaces[rootDir];
      if (existingWorkspace !== undefined) {
        return existingWorkspace;
      }
      const frameworkPluginName = await core.findCompatiblePlugin(
        logger,
        rootDir,
        frameworkPlugins
      );
      const frameworkPlugin = frameworkPlugins.find(
        (p) => p.info?.name === frameworkPluginName
      );
      if (!frameworkPluginName || !frameworkPlugin) {
        // Note: This caches the incompatibility of a workspace (i.e. caching null), which
        // would be problematic especially when package.json is updated to a compatible
        // package version.
        // TODO: Find a smarter approach, perhaps checking last-modified time of package.json and node_modules.
        workspaces[rootDir] = null;
        return null;
      }
      // Note: we check again here because of race conditions while awaiting above.
      existingWorkspace = workspaces[rootDir];
      if (existingWorkspace !== undefined) {
        return existingWorkspace;
      }

      return (workspaces[rootDir] = core
        .createWorkspace({
          logger,
          rootDir,
          reader,
          frameworkPlugin,
          onServerStart: () => {
            throw new Error(
              `Workspace running in loader process should not start server`
            );
          },
        })
        .then(
          (workspace: Workspace): Workspace => ({
            ...workspace,
            startServer: async (options) => {
              const worker = await ensureWorkerRunning(
                logger,
                logLevel,
                versionCode,
                workerFilePath,
                rootDir,
                frameworkPluginName,
                options?.port
              );
              return {
                url: () => worker.url,
                stop: async () => worker.kill(),
              };
            },
            dispose: async () => {
              const serverWorker = serverWorkers[rootDir];
              delete workspaces[rootDir];
              delete serverWorkers[rootDir];
              await workspace.dispose();
              (await serverWorker)?.kill();
            },
          })
        ));
    },
    async dispose() {
      const promises: Array<Promise<void>> = [];
      for (const workspace of Object.values(workspaces)) {
        if (!workspace) {
          continue;
        }
        promises.push(workspace.then((w) => w.dispose()));
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
    frameworkPluginName: string,
    port?: number
  ) {
    const existingWorker = serverWorkers[rootDir];
    if (existingWorker) {
      return existingWorker;
    }
    const worker = fork(workerFilePath, {
      // Note: this is required for PostCSS.
      cwd: rootDir,
      stdio: "pipe",
    });
    worker.stdout?.pipe(prettyLoggerStream);
    worker.stderr?.pipe(prettyLoggerStream);
    const killWorker = () => {
      delete serverWorkers[rootDir];
      worker.kill();
    };
    worker.on("error", (error) => {
      logger.error(error);
      killWorker();
    });
    worker.on("exit", () => {
      // Note: we should double check that there isn't a race condition if we
      // re-create the worker.
      delete serverWorkers[rootDir];
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
        port,
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
    let resolveWorkerReady: (state: { url: string }) => void;
    let rejectWorkerReady: ((error: any) => void) | null;
    const workerReadyPromise = new Promise<{ url: string }>(
      (resolve, reject) => {
        resolveWorkerReady = resolve;
        rejectWorkerReady = reject;
      }
    );
    worker.on("message", (message: FromWorkerMessage) => {
      switch (message.kind) {
        case "ready":
          resolveWorkerReady(message);
          rejectWorkerReady = null;
          break;
        case "crash":
          logger.error(message.message);
          delete serverWorkers[rootDir];
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
    return (serverWorkers[rootDir] = workerReadyPromise.then(({ url }) => ({
      url,
      request,
      kill: killWorker,
    })));
  }
}
