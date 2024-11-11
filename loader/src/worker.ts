import { assertNever } from "assert-never";
import pino from "pino";
import { loadModules } from "./modules.js";
import type {
  FromWorkerMessage,
  ToWorkerMessage,
  UpdateInMemoryFileRequest,
  WorkerData,
  WorkerRequest,
  WorkerResponseType,
} from "./worker-api.js";
const { pino: createLogger } = pino;

async function runWorker({
  logLevel,
  versionCode,
  installDir,
  rootDir,
  inMemorySnapshot,
  frameworkPluginName,
  port,
  clientPort,
  onServerStartModuleName,
}: WorkerData) {
  const logger = createLogger(
    { level: logLevel },
    {
      write(message) {
        sendMessageFromWorker({
          kind: "log",
          message,
        });
      },
    }
  );
  const { core, vfs, frameworkPlugins, onServerStart } = await loadModules({
    logger,
    installDir,
    onServerStartModuleName,
  });
  const memoryReader = vfs.createMemoryReaderFromSnapshot(inMemorySnapshot);
  const fsReader = vfs.createFileSystemReader({
    watch: true,
  });
  const reader = vfs.createStackedReader([memoryReader, fsReader]);

  const frameworkPlugin = frameworkPlugins.find(
    (p) => p.info?.name === frameworkPluginName
  );
  if (!frameworkPlugin) {
    throw new Error(
      `Could not find framework plugin named "${frameworkPluginName}"`
    );
  }
  async function handleRequest(request: WorkerRequest, requestId: number) {
    try {
      const response = await (() => {
        switch (request.kind) {
          case "update-in-memory-file":
            return handleUpdateInMemoryFileRequest(request.body);
          default:
            throw assertNever(request.kind);
        }
      })();
      sendMessageFromWorker({
        kind: "response",
        requestId,
        data: {
          kind: "success",
          response,
        },
      });
    } catch (e: any) {
      sendMessageFromWorker({
        kind: "response",
        requestId,
        data: {
          kind: "error",
          message: e.message || `${e}`,
        },
      });
    }
  }

  async function handleUpdateInMemoryFileRequest(
    request: UpdateInMemoryFileRequest["body"]
  ): Promise<WorkerResponseType<UpdateInMemoryFileRequest>> {
    memoryReader.updateFile(request.absoluteFilePath, request.text);
    return {};
  }

  const workspace = await core.createWorkspace({
    logger,
    rootDir,
    reader,
    frameworkPlugin,
    onServerStart: (options) =>
      onServerStart({
        versionCode,
        ...options,
      }),
  });
  logger.info(
    `Created Preview.js workspace (plugin: ${workspace.frameworkPluginName}) at ${rootDir}`
  );

  process.on("message", (message: ToWorkerMessage) => {
    switch (message.kind) {
      case "init":
        throw new Error(`Unexpected double init received in worker`);
      case "request":
        handleRequest(message.request, message.requestId);
        break;
      default:
        throw assertNever(message);
    }
  });

  const server = await workspace.startServer({
    port,
    clientPort,
  });

  sendMessageFromWorker({
    kind: "ready",
    port: server.port,
  });
}

async function sendMessageFromWorker(message: FromWorkerMessage) {
  process.send!(message);
}

const waitForInit = (message: ToWorkerMessage) => {
  if (message.kind === "init") {
    runWorker(message.data).catch((e) => {
      sendMessageFromWorker({
        kind: "crash",
        message: e.message || `${e}`,
      });
    });
    process.off("message", waitForInit);
  }
};
process.on("message", waitForInit);

const parentProcessId = parseInt(
  process.env["PREVIEWJS_PARENT_PROCESS_PID"] || "0"
);
if (!parentProcessId) {
  throw new Error("Missing environment variable: PREVIEWJS_PARENT_PROCESS_PID");
}
// Kill the worker if the parent process dies.
setInterval(() => {
  try {
    process.kill(parentProcessId, 0);
    // Parent process is still alive, see https://stackoverflow.com/a/21296291.
  } catch {
    process.exit(0);
  }
}, 1000);
