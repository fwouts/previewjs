import type { PreviewServer } from "@previewjs/core";
import assertNever from "assert-never";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import { loadModules } from "./modules";
import type {
  CrawlFileRequest,
  FromWorkerMessage,
  StartServerRequest,
  StopServerRequest,
  ToWorkerMessage,
  WorkerData,
  WorkerRequest,
  WorkerResponseType,
} from "./worker-api";

async function runWorker({
  logLevel,
  versionCode,
  installDir,
  rootDir,
  inMemorySnapshot,
  frameworkPluginName,
  onServerStartModuleName,
}: WorkerData) {
  const prettyLoggerStream = prettyLogger({
    colorize: true,
    destination: process.stdout,
  });
  const logger = createLogger({ level: logLevel }, prettyLoggerStream);
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
          case "crawl-files":
            return handleCrawlFilesRequest(request.body);
          case "start-server":
            return handleStartServerRequest(request.body);
          case "stop-server":
            return handleStopServerRequest(request.body);
          default:
            throw assertNever(request);
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

  async function handleCrawlFilesRequest(
    request: CrawlFileRequest["body"]
  ): Promise<WorkerResponseType<CrawlFileRequest>> {
    const { components, stories } = await workspace.crawlFiles(
      request.absoluteFilePaths
    );
    return {
      previewables: [...components, ...stories].map((c) => ({
        id: c.id,
        start: c.sourcePosition.start,
        end: c.sourcePosition.end,
      })),
    };
  }

  const previewServers: Record<number, PreviewServer> = {};
  let nextPreviewServerId = 0;

  async function handleStartServerRequest(
    request: StartServerRequest["body"]
  ): Promise<WorkerResponseType<StartServerRequest>> {
    const server = (previewServers[nextPreviewServerId] =
      await workspace.startServer(request));
    return {
      serverId: nextPreviewServerId++,
      url: server.url(),
    };
  }

  async function handleStopServerRequest(
    request: StopServerRequest["body"]
  ): Promise<WorkerResponseType<StopServerRequest>> {
    const previewServer = previewServers[request.serverId];
    await previewServer?.stop();
    delete previewServers[request.serverId];
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
      case "in-memory-file-update":
        memoryReader.updateFile(message.absoluteFilePath, message.text);
        break;
      case "request":
        handleRequest(message.request, message.requestId);
        break;
      default:
        throw assertNever(message);
    }
  });

  sendMessageFromWorker({
    kind: "ready",
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
