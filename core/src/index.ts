import { decodePreviewableId, type Analyzer } from "@previewjs/analyzer-api";
import { RPCs } from "@previewjs/api";
import type {
  CollectedTypes,
  TypeAnalyzer,
  ValueType,
} from "@previewjs/type-analyzer";
import { UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import { createFileSystemReader, type Reader } from "@previewjs/vfs";
import express from "express";
import fs from "fs-extra";
import http from "http";
import { createHttpTerminator } from "http-terminator";
import { createRequire } from "module";
import path from "path";
import type { Logger } from "pino";
import pino from "pino";
import PinoPretty from "pino-pretty";
import { crawlFiles } from "./crawl-files.js";
import { getFreePort } from "./get-free-port.js";
import { extractPackageDependencies } from "./plugins/dependencies.js";
import type { FrameworkPluginFactory } from "./plugins/framework.js";
import type { OnServerStart } from "./preview-env.js";
import { Previewer, type GetHttpServer } from "./previewer.js";
import { ApiRouter } from "./router.js";
const { pino: createLogger } = pino;
const { default: prettyLogger } = PinoPretty;
export type { PackageDependencies } from "./plugins/dependencies.js";
export { findCompatiblePlugin } from "./plugins/find-compatible-plugin.js";
export type {
  FrameworkPlugin,
  FrameworkPluginFactory,
} from "./plugins/framework.js";
export type { OnServerStart } from "./preview-env.js";
export { toVitePath } from "./vite/vite-paths.js";

const require = createRequire(import.meta.url);

process.on("uncaughtException", (e) => {
  // eslint-disable-next-line no-console
  console.error("Encountered an uncaught exception", e);
});
process.on("unhandledRejection", (e) => {
  // eslint-disable-next-line no-console
  console.error("Encountered an unhandled promise", e);
});

export async function createWorkspace({
  rootDir,
  frameworkPlugin: frameworkPluginFactory,
  logger = createLogger(
    { level: process.env["PREVIEWJS_LOG_LEVEL"]?.toLowerCase() || "warn" },
    prettyLogger({ colorize: true })
  ),
  reader = createFileSystemReader(),
  onServerStart = () => Promise.resolve({}),
}: {
  rootDir: string;
  frameworkPlugin: FrameworkPluginFactory;
  logger?: Logger;
  reader?: Reader;
  onServerStart?: OnServerStart;
}): Promise<Workspace> {
  const expectedPluginApiVersion = 5;
  if (!frameworkPluginFactory.info) {
    throw new Error(
      `Provided framework plugin is incompatible with this version of Preview.js. Please upgrade it.`
    );
  } else if (
    frameworkPluginFactory.info.apiVersion > expectedPluginApiVersion
  ) {
    throw new Error(
      `Preview.js framework plugin ${frameworkPluginFactory.info.name} is too recent. Please upgrade Preview.js or use an older version of ${frameworkPluginFactory.info.name}.`
    );
  }
  const dependencies = await extractPackageDependencies(logger, rootDir);
  if (!(await frameworkPluginFactory.isCompatible(dependencies))) {
    throw new Error(
      `Preview.js framework plugin ${frameworkPluginFactory.info.name} is not compatible with workspace dependencies.`
    );
  }
  logger.debug(
    `Creating workspace with framework plugin ${frameworkPluginFactory.info.name} from root: ${rootDir}`
  );
  const frameworkPlugin = await frameworkPluginFactory.create({
    rootDir,
    reader,
    logger,
    dependencies,
  });
  const activePreviewers = new Set<Previewer>();
  const workspace: Workspace = {
    frameworkPluginName: frameworkPluginFactory.info.name,
    crawlFiles: frameworkPlugin.crawlFiles,
    typeAnalyzer: frameworkPlugin.typeAnalyzer,
    rootDir,
    reader,
    startServer: async ({
      asMiddleware,
      port: maybePort,
      clientPort,
      onStop,
    } = {}) => {
      const port = maybePort || (await getFreePort(3140));
      const router = new ApiRouter(logger);
      router.registerRPC(RPCs.Analyze, async ({ previewableIds }) => {
        logger.debug(`Analyzing: ${previewableIds.join(", ")}`);
        const detected = await frameworkPlugin.crawlFiles([
          ...new Set(
            previewableIds.map((c) =>
              path.join(rootDir, decodePreviewableId(c).filePath)
            )
          ),
        ]);
        logger.debug(
          `Detected ${detected.components.length} components and ${detected.stories.length} stories`
        );
        const previewables: Array<RPCs.AnalyzedComponent | RPCs.AnalyzedStory> =
          [];
        const idToDetectedComponent = Object.fromEntries(
          detected.components.map((c) => [c.id, c])
        );
        const idToDetectedStory = Object.fromEntries(
          detected.stories.map((c) => [c.id, c])
        );
        let types: CollectedTypes = {};
        for (const id of previewableIds) {
          const component = idToDetectedComponent[id];
          const story = idToDetectedStory[id];
          let componentTypes: CollectedTypes;
          if (component) {
            logger.debug(`Analyzing component: ${id}`);
            let props: ValueType;
            ({ props, types: componentTypes } = await component.analyze());
            logger.debug(`Done analyzing: ${id}`);
            previewables.push({
              kind: "component",
              id,
              exported: component.exported,
              sourcePosition: component.sourcePosition,
              props,
            });
          } else if (story) {
            let props: ValueType;
            if (story.associatedComponent) {
              logger.debug(`Analyzing story: ${id}`);
              ({ props, types: componentTypes } =
                await story.associatedComponent.analyze());
              logger.debug(`Done analyzing: ${id}`);
            } else {
              logger.debug(`No associated component for story: ${id}`);
              props = UNKNOWN_TYPE;
              componentTypes = {};
            }
            previewables.push({
              kind: "story",
              id,
              sourcePosition: story.sourcePosition,
              associatedComponentId: story.associatedComponent?.id || null,
              props,
              args: (await story.analyze()).args,
            });
          } else {
            const { filePath, name } = decodePreviewableId(id);
            throw new Error(`Component ${name} not detected in ${filePath}.`);
          }
          types = { ...types, ...componentTypes };
        }
        return {
          previewables,
          types,
        };
      });
      router.registerRPC(RPCs.GetInfo, async () => ({
        frameworkPlugin: frameworkPluginFactory.info,
      }));
      router.registerRPC(RPCs.CrawlFiles, (options) =>
        crawlFiles(logger, workspace, frameworkPlugin, options)
      );
      const middlewares: express.Handler[] = [
        express.json(),
        async (req, res, next) => {
          if (req.path.startsWith("/api/")) {
            res.json(await router.handle(req.path.substr(5), req.body));
          } else {
            next();
          }
        },
      ];
      if (onServerStart) {
        const { middlewares: additionalMiddlewares = [] } = await onServerStart(
          {
            registerRPC: (endpoint, handler) =>
              router.registerRPC(endpoint, handler),
            workspace,
          }
        );
        middlewares.push(...additionalMiddlewares);
      }
      const getHttpServer: GetHttpServer = asMiddleware
        ? async (router) => {
            const unregister = asMiddleware.register(router);
            return {
              server: asMiddleware.server,
              disposeHttpServer: async () => {
                unregister();
              },
            };
          }
        : async (router) => {
            logger.debug(`Starting server`);
            const app = express();
            app.use(router);
            const server = await new Promise<http.Server>((resolve) => {
              const server = app.listen(port, () => {
                logger.info(
                  `Preview.js server running at http://localhost:${port}.`
                );
                resolve(server);
              });
            });
            const serverTerminator = createHttpTerminator({
              server,
              gracefulTerminationTimeout: 0,
            });
            return {
              server,
              disposeHttpServer: async () => {
                await serverTerminator.terminate();
                logger.info(`Preview.js server stopped.`);
              },
            };
          };
      const previewer = new Previewer({
        reader,
        rootDir,
        // TODO: Use a cleaner approach.
        previewDirPath: path.join(
          path.dirname(path.dirname(require.resolve("@previewjs/iframe"))),
          "preview"
        ),
        frameworkPlugin,
        logger,
        middlewares,
        getHttpServer,
        port,
        clientPort,
      });
      await previewer.start();
      activePreviewers.add(previewer);
      return {
        port,
        stop: async () => {
          activePreviewers.delete(previewer);
          await previewer.stop();
          await onStop?.();
        },
      };
    },
    dispose: async () => {
      await Promise.all(
        [...activePreviewers].map((previewer) => previewer.stop())
      );
      activePreviewers.clear();
      // Note: We may also want to reuse FrameworkPlugin for multiple workspaces, in which case
      // dispose() should not be called here?
      frameworkPlugin.dispose();
    },
  };
  return workspace;
}

/**
 * Returns the absolute directory path of the closest ancestor containing package.json.
 */
export function findWorkspaceRoot(absoluteFilePath: string): string | null {
  let dirPath = path.resolve(absoluteFilePath);
  while (dirPath !== path.dirname(dirPath)) {
    if (fs.existsSync(path.join(dirPath, "package.json"))) {
      return dirPath;
    }
    dirPath = path.dirname(dirPath);
  }
  return null;
}

export interface Workspace {
  rootDir: string;
  reader: Reader;
  frameworkPluginName: string;
  typeAnalyzer: Omit<TypeAnalyzer, "dispose">;
  crawlFiles: Analyzer["crawlFiles"];
  startServer: (
    options?: {
      port?: number;
      clientPort?: number;
      onStop?: () => void;
    } & (
      | {
          asMiddleware?: never;
        }
      | {
          asMiddleware: {
            server: http.Server;
            register: (handler: express.RequestHandler) => () => void;
          };
          port: number;
        }
    )
  ) => Promise<PreviewServer>;
  dispose(): Promise<void>;
}

export interface PreviewServer {
  port: number;
  stop(): Promise<void>;
}
