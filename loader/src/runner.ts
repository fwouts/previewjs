import type { Workspace } from "@previewjs/core";
import type { ReaderListener } from "@previewjs/vfs";
import assertNever from "assert-never";
import fs from "fs-extra";
import { fork } from "node:child_process";
import path from "path";
import createLogger, { type Logger } from "pino";
import prettyLogger from "pino-pretty";
import type { LogLevel } from "./index.js";
import { installDependenciesIfRequired, loadModules } from "./modules.js";
import {
  resolvablePromise,
  type ResolvablePromise,
} from "./resolvable-promise.js";
import {
  type FromWorkerMessage,
  type ToWorkerMessage,
  type WorkerRequest,
  type WorkerResponse,
  type WorkerResponseType,
} from "./worker-api.js";

const validLogLevels = new Set<unknown>(["debug", "info", "error", "silent"]);

export type ServerWorker = {
  port: number;
  request: <Request extends WorkerRequest>(
    request: Request
  ) => Promise<WorkerResponseType<Request>>;
  kill: () => Promise<void>;
  exiting?: boolean;
  waitUntilExited: Promise<void>;
  onStop: Array<() => void>;
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
    [rootDir: string]: {
      lastAccessed: number;
      promise: Promise<Workspace> | null;
    };
  } = {};
  const serverWorkers: {
    [rootDir: string]: ResolvablePromise<ServerWorker>;
  } = {};

  const WORKSPACE_DISPOSE_CHECK_INTERVAL_MILLIS = 1_000;
  const DISPOSE_UNUSED_WORKSPACE_AFTER_MILLIS = 60_000;
  setInterval(() => {
    for (const [rootDir, workspace] of Object.entries(workspaces)) {
      if (
        !workspace ||
        serverWorkers[rootDir] ||
        workspace.lastAccessed >
          Date.now() - DISPOSE_UNUSED_WORKSPACE_AFTER_MILLIS
      ) {
        continue;
      }
      workspace.promise
        ?.then((workspace) => workspace.dispose())
        .catch((e) => globalLogger.error(e));
      delete workspaces[rootDir];
    }
  }, WORKSPACE_DISPOSE_CHECK_INTERVAL_MILLIS);

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
    /**
     * Runs the specified code block in a workspace.
     *
     * NOTE: The workspace may be disposed of after `run()` is done running.
     * It is not safe to hold onto the workspace reference outside of this.
     */
    async inWorkspace<T>({
      versionCode,
      absoluteFilePath,
      run,
    }: {
      versionCode: string;
      absoluteFilePath: string;
      run: (workspace: Workspace | null) => Promise<T>;
    }): Promise<T> {
      const workspace = await getWorkspace(versionCode, absoluteFilePath);
      if (workspace.promise) {
        workspace.lastAccessed = Date.now();
        // Ensure the workspace will not be disposed of while run() is running.
        const keepAliveInterval = setInterval(() => {
          workspace.lastAccessed = Date.now();
        }, WORKSPACE_DISPOSE_CHECK_INTERVAL_MILLIS);
        try {
          return await run(await workspace.promise);
        } finally {
          clearInterval(keepAliveInterval);
        }
      } else {
        return run(null);
      }
    },
    async dispose() {
      const promises: Array<Promise<void>> = [];
      for (const workspace of Object.values(workspaces)) {
        if (!workspace.promise) {
          continue;
        }
        promises.push(workspace.promise.then((w) => w.dispose()));
      }
      await Promise.all(promises);
    },
  };

  async function getWorkspace(
    versionCode: string,
    absoluteFilePath: string
  ): Promise<{
    lastAccessed: number;
    promise: Promise<Workspace> | null;
  }> {
    const rootDir = core.findWorkspaceRoot(absoluteFilePath);
    if (!rootDir) {
      globalLogger.info(`No workspace root detected from ${absoluteFilePath}`);
      return {
        lastAccessed: Date.now(),
        promise: null,
      };
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
      return (workspaces[rootDir] = {
        lastAccessed: Date.now(),
        promise: null,
      });
    }
    // Note: we check again here because of race conditions while awaiting above.
    existingWorkspace = workspaces[rootDir];
    if (existingWorkspace !== undefined) {
      return existingWorkspace;
    }

    return (workspaces[rootDir] = {
      lastAccessed: Date.now(),
      promise: core
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
        .then(async (workspace: Workspace): Promise<Workspace> => {
          const nodeModulesChangeListener: ReaderListener = {
            onChange: () => {
              const workerPromise = serverWorkers[rootDir];
              const worker = workerPromise?.resolved;
              if (!worker || worker.exiting) {
                logger.debug(
                  `Detected node_modules change for ${rootDir} but no running worker found`
                );
                // If worker isn't currently running, ignore.
                return;
              }
              logger.debug(
                `Restarting server worker for ${rootDir} because of detected node_modules change`
              );
              // Note: we don't await here because ensureWorkerRunning() will take care of that.
              worker.kill().catch((e) => logger.error(e));
              ensureWorkerRunning({
                logger,
                logLevel,
                versionCode,
                workerFilePath,
                rootDir,
                frameworkPluginName,
                port: worker.port,
              });
            },
          };
          const stopObserving = await fsReader.observe?.(
            path.join(rootDir, "node_modules"),
            {
              // Note: important to ensure node_modules isn't ignored by default.
              ignored: [path.join(rootDir, "node_modules", ".previewjs", "**")],
              // Don't look too deep, we only want to know if a node module changes.
              depth: 2,
            }
          );
          fsReader.listeners.add(nodeModulesChangeListener);
          const workerDelegatingWorkspace: Workspace = {
            ...workspace,
            startServer: async ({ port, onStop } = {}) => {
              const worker = await ensureWorkerRunning({
                logger,
                logLevel,
                versionCode,
                workerFilePath,
                rootDir,
                frameworkPluginName,
                port,
              });
              if (onStop) {
                worker.onStop.push(onStop);
              }
              return {
                port: worker.port,
                stop: async () => {
                  const worker = await serverWorkers[rootDir];
                  await worker?.kill();
                },
              };
            },
            dispose: async () => {
              logger.debug(`Disposing of workspace for ${rootDir}`);
              const serverWorker = serverWorkers[rootDir];
              delete workspaces[rootDir];
              delete serverWorkers[rootDir];
              fsReader.listeners.remove(nodeModulesChangeListener);
              await stopObserving?.();
              await workspace.dispose();
              await (await serverWorker)?.kill();
            },
          };
          return workerDelegatingWorkspace;
        }),
    });
  }

  // Note: this should remain a sync function to prevent any race conditions.
  function ensureWorkerRunning(options: {
    logger: Logger;
    logLevel: LogLevel;
    versionCode: string;
    workerFilePath: string;
    rootDir: string;
    frameworkPluginName: string;
    port?: number;
  }): ResolvablePromise<ServerWorker> {
    const {
      logger,
      logLevel,
      versionCode,
      workerFilePath,
      rootDir,
      frameworkPluginName,
      port,
    } = options;
    const existingWorker = serverWorkers[rootDir];
    if (existingWorker) {
      if (existingWorker.resolved?.exiting) {
        return resolvablePromise(
          existingWorker.resolved.waitUntilExited.then(() =>
            ensureWorkerRunning(options)
          )
        );
      } else {
        return existingWorker;
      }
    }
    const workerProcess = fork(workerFilePath, {
      // Note: this is required for PostCSS.
      cwd: rootDir,
      stdio: "inherit",
    });
    const killWorker = async () => {
      if (workerPromise?.resolved) {
        workerPromise.resolved.exiting = true;
      }
      workerProcess.kill();
      await workerExitedPromise;
      delete serverWorkers[rootDir];
    };
    let onWorkerExited = () => {};
    const workerExitedPromise = new Promise<void>((resolve) => {
      onWorkerExited = resolve;
    });
    workerProcess.on("error", (error) => {
      logger.error(error);
      killWorker();
    });
    const onStopListeners: Array<() => void> = [];
    workerProcess.on("exit", () => {
      if (serverWorkers[rootDir] === workerPromise) {
        delete serverWorkers[rootDir];
        for (const onStop of onStopListeners) {
          try {
            onStop();
          } catch (e) {
            logger.error(e);
          }
        }
      }
      onWorkerExited();
    });
    const send = (message: ToWorkerMessage) => workerProcess.send(message);
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
    let resolveWorkerReady: (state: { port: number }) => void;
    let rejectWorkerReady: ((error: any) => void) | null;
    const workerReadyPromise = new Promise<{ port: number }>(
      (resolve, reject) => {
        resolveWorkerReady = resolve;
        rejectWorkerReady = reject;
      }
    );
    workerProcess.on("message", (message: FromWorkerMessage) => {
      switch (message.kind) {
        case "ready":
          resolveWorkerReady(message);
          rejectWorkerReady = null;
          break;
        case "log":
          prettyLoggerStream.write(message.message);
          break;
        case "crash":
          logger.error(message.message);
          rejectWorkerReady?.(new Error(message.message));
          killWorker();
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
    const workerPromise = (serverWorkers[rootDir] = resolvablePromise(
      workerReadyPromise.then(
        ({ port }): ServerWorker => ({
          port,
          request,
          kill: killWorker,
          waitUntilExited: workerExitedPromise,
          onStop: onStopListeners,
        })
      )
    ));
    return workerPromise;
  }
}
