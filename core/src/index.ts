import type { RequestOf, ResponseOf, RPC } from "@previewjs/api";
import { RPCs } from "@previewjs/api";
import { decodePreviewableId } from "@previewjs/component-analyzer-api";
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
import { detectComponents } from "./detect-components";
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
  router.registerRPC(RPCs.ComputeProps, async ({ previewableIds }) => {
    logger.debug(
      `Computing props for components: ${previewableIds.join(", ")}`
    );
    const detected = await frameworkPlugin.detectComponents([
      ...new Set(
        previewableIds.map((c) =>
          path.join(rootDir, decodePreviewableId(c).filePath)
        )
      ),
    ]);
    logger.debug(
      `Detected ${detected.components.length} components and ${detected.stories.length} stories`
    );
    const previewableIdToDetectedComponent = Object.fromEntries(
      detected.components.map((c) => [c.previewableId, c])
    );
    const previewableIdToDetectedStory = Object.fromEntries(
      detected.stories.map((c) => [c.previewableId, c])
    );
    const propsPerComponentId: {
      [componentId: string]: ValueType;
    } = {};
    const argsPerStoryId: {
      [storyId: string]: RPCs.StoryArgs | null;
    } = {};
    let types: CollectedTypes = {};
    for (const previewableId of previewableIds) {
      const component = previewableIdToDetectedComponent[previewableId];
      const story = previewableIdToDetectedStory[previewableId];
      let props: ValueType;
      let componentTypes: CollectedTypes;
      if (component) {
        logger.debug(`Analyzing component: ${previewableId}`);
        ({ props, types: componentTypes } = await component.extractProps());
        propsPerComponentId[previewableId] = props;
        logger.debug(`Done analyzing: ${previewableId}`);
      } else if (story) {
        if (story.associatedComponent) {
          logger.debug(`Analyzing story: ${previewableId}`);
          ({ props, types: componentTypes } =
            await story.associatedComponent.extractProps());
          logger.debug(`Done analyzing: ${previewableId}`);
        } else {
          logger.debug(`No associated component for story: ${previewableId}`);
          props = UNKNOWN_TYPE;
          componentTypes = {};
        }
        argsPerStoryId[previewableId] = await story.extractArgs();
      } else {
        const { filePath, name } = decodePreviewableId(previewableId);
        throw new Error(`Component ${name} not detected in ${filePath}.`);
      }
      propsPerComponentId[previewableId] = props;
      types = { ...types, ...componentTypes };
    }
    return {
      props: propsPerComponentId,
      args: argsPerStoryId,
      types,
    };
  });
  router.registerRPC(RPCs.DetectComponents, (options) =>
    detectComponents(logger, workspace, frameworkPlugin, options)
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
    detectComponents: (options = {}) =>
      localRpc(RPCs.DetectComponents, options),
    computeProps: (options) => localRpc(RPCs.ComputeProps, options),
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
  detectComponents(
    options?: RequestOf<typeof RPCs.DetectComponents>
  ): Promise<ResponseOf<typeof RPCs.DetectComponents>>;
  computeProps(
    options: RequestOf<typeof RPCs.ComputeProps>
  ): Promise<ResponseOf<typeof RPCs.ComputeProps>>;
  preview: {
    start(allocatePort?: () => Promise<number>): Promise<Preview>;
  };
  dispose(): Promise<void>;
}

export interface Preview {
  url(): string;
  stop(): Promise<void>;
}
