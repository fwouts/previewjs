import { decodePreviewableId } from "@previewjs/analyzer-api";
import type { RequestOf, ResponseOf, RPC } from "@previewjs/api";
import { RPCs } from "@previewjs/api";
import type {
  CollectedTypes,
  TypeAnalyzer,
  ValueType,
} from "@previewjs/type-analyzer";
import { UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import express from "express";
import fs from "fs-extra";
import { createRequire } from "module";
import path from "path";
import type { Logger } from "pino";
import { crawlFile } from "./crawl-file";
import { getFreePort } from "./get-free-port";
import type { FrameworkPlugin } from "./plugins/framework";
import type { SetupPreviewEnvironment } from "./preview-env";
import { Previewer } from "./previewer";
import { ApiRouter } from "./router";
export type { PackageDependencies } from "./plugins/dependencies";
export type {
  FrameworkPlugin,
  FrameworkPluginFactory,
} from "./plugins/framework";
export { setupFrameworkPlugin } from "./plugins/setup-framework-plugin";
export type { SetupPreviewEnvironment } from "./preview-env";

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
  reader,
  frameworkPlugin,
  logger,
  setupEnvironment,
}: {
  rootDir: string;
  frameworkPlugin: FrameworkPlugin;
  logger: Logger;
  reader: Reader;
  setupEnvironment?: SetupPreviewEnvironment;
}): Promise<Workspace> {
  logger.debug(
    `Creating workspace with framework plugin ${frameworkPlugin.name} from root: ${rootDir}`
  );
  const expectedPluginApiVersion = 4;
  if (
    !frameworkPlugin.pluginApiVersion ||
    frameworkPlugin.pluginApiVersion < expectedPluginApiVersion
  ) {
    throw new Error(
      `Preview.js framework plugin ${frameworkPlugin.name} is incompatible with this version of Preview.js. Please upgrade it.`
    );
  } else if (frameworkPlugin.pluginApiVersion > expectedPluginApiVersion) {
    throw new Error(
      `Preview.js framework plugin ${frameworkPlugin.name} is too recent. Please upgrade Preview.js or use an older version of ${frameworkPlugin.name}.`
    );
  }
  const router = new ApiRouter(logger);
  router.registerRPC(RPCs.Analyze, async ({ previewableIds }) => {
    logger.debug(`Analyzing: ${previewableIds.join(", ")}`);
    const detected = await frameworkPlugin.crawlFile([
      ...new Set(
        previewableIds.map((c) =>
          path.join(rootDir, decodePreviewableId(c).filePath)
        )
      ),
    ]);
    logger.debug(
      `Detected ${detected.components.length} components and ${detected.stories.length} stories`
    );
    const idToDetectedComponent = Object.fromEntries(
      detected.components.map((c) => [c.id, c])
    );
    const idToDetectedStory = Object.fromEntries(
      detected.stories.map((c) => [c.id, c])
    );
    const propsPerComponentId: {
      [componentId: string]: ValueType;
    } = {};
    const argsPerStoryId: {
      [storyId: string]: RPCs.StoryArgs | null;
    } = {};
    let types: CollectedTypes = {};
    for (const id of previewableIds) {
      const component = idToDetectedComponent[id];
      const story = idToDetectedStory[id];
      let props: ValueType;
      let componentTypes: CollectedTypes;
      if (component) {
        logger.debug(`Analyzing component: ${id}`);
        ({ props, types: componentTypes } = await component.analyze());
        propsPerComponentId[id] = props;
        logger.debug(`Done analyzing: ${id}`);
      } else if (story) {
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
        argsPerStoryId[id] = await story.analyze();
      } else {
        const { filePath, name } = decodePreviewableId(id);
        throw new Error(`Component ${name} not detected in ${filePath}.`);
      }
      propsPerComponentId[id] = props;
      types = { ...types, ...componentTypes };
    }
    return {
      props: propsPerComponentId,
      args: argsPerStoryId,
      types,
    };
  });
  router.registerRPC(RPCs.CrawlFile, (options) =>
    crawlFile(logger, workspace, frameworkPlugin, options)
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
    onFileChanged: (absoluteFilePath) => {
      const filePath = path.relative(rootDir, absoluteFilePath);
      frameworkPlugin.typeAnalyzer.invalidateCachedTypesForFile(filePath);
    },
  });

  async function localRpc<E extends RPC<any, any>>(
    endpoint: E,
    request: RequestOf<E>
  ): Promise<ResponseOf<E>> {
    const result = await router.handle(endpoint.path, request);
    if (result.kind === "success") {
      return result.response as ResponseOf<E>;
    }
    throw new Error(result.message);
  }

  const workspace: Workspace = {
    rootDir,
    reader,
    typeAnalyzer: frameworkPlugin.typeAnalyzer,
    crawlFile: (options = {}) => localRpc(RPCs.CrawlFile, options),
    analyze: (options) => localRpc(RPCs.Analyze, options),
    preview: {
      start: async (allocatePort) => {
        const port = await previewer.start(async () => {
          const port = allocatePort ? await allocatePort() : 0;
          return port || (await getFreePort(3140));
        });
        return {
          url: () => `http://localhost:${port}`,
          stop: async () => {
            await previewer.stop();
          },
        };
      },
    },
    dispose: async () => {
      // Note: We may also want to reuse FrameworkPlugin for multiple workspaces, in which case
      // dispose() should not be called here?
      frameworkPlugin.dispose();
    },
  };
  if (setupEnvironment) {
    const environment = await setupEnvironment({
      registerRPC: (endpoint, handler) => router.registerRPC(endpoint, handler),
      workspace,
    });
    if (environment.middlewares) {
      middlewares.push(...environment.middlewares);
    }
  }
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
  typeAnalyzer: Omit<TypeAnalyzer, "dispose">;
  crawlFile(
    options?: RequestOf<typeof RPCs.CrawlFile>
  ): Promise<ResponseOf<typeof RPCs.CrawlFile>>;
  analyze(
    options: RequestOf<typeof RPCs.Analyze>
  ): Promise<ResponseOf<typeof RPCs.Analyze>>;
  preview: {
    start(allocatePort?: () => Promise<number>): Promise<Preview>;
  };
  dispose(): Promise<void>;
}

export interface Preview {
  url(): string;
  stop(): Promise<void>;
}
