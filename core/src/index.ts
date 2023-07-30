import type { RequestOf, ResponseOf, RPC } from "@previewjs/api";
import { decodeComponentId, RPCs } from "@previewjs/api";
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
import type { ComponentAnalysis, FrameworkPlugin } from "./plugins/framework";
import type { SetupPreviewEnvironment } from "./preview-env";
import { Previewer } from "./previewer";
import { ApiRouter } from "./router";
export type { PackageDependencies } from "./plugins/dependencies";
export type {
  AnalyzableComponent,
  ComponentAnalysis,
  ComponentTypeInfo,
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
  rootDirPath,
  reader,
  frameworkPlugin,
  logger,
  setupEnvironment,
}: {
  rootDirPath: string;
  frameworkPlugin: FrameworkPlugin;
  logger: Logger;
  reader: Reader;
  setupEnvironment?: SetupPreviewEnvironment;
}): Promise<Workspace> {
  logger.debug(
    `Creating workspace with framework plugin ${frameworkPlugin.name} from root: ${rootDirPath}`
  );
  const expectedPluginApiVersion = 3;
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
  if (frameworkPlugin.transformReader) {
    reader = frameworkPlugin.transformReader(reader);
  }
  const router = new ApiRouter(logger);
  router.registerRPC(RPCs.ComputeProps, async ({ componentIds }) => {
    logger.debug(`Computing props for components: ${componentIds.join(", ")}`);
    let analyze: () => Promise<ComponentAnalysis>;
    const detectedComponents = await frameworkPlugin.detectComponents([
      ...new Set(
        componentIds.map((c) =>
          path.join(rootDirPath, decodeComponentId(c).filePath)
        )
      ),
    ]);
    logger.debug(`Detected ${detectedComponents.length} components`);
    const componentIdToDetectedComponent = Object.fromEntries(
      detectedComponents.map((c) => [c.componentId, c])
    );
    const components: {
      [componentId: string]: {
        info: RPCs.ComponentInfo;
        props: ValueType;
      };
    } = {};
    let types: CollectedTypes = {};
    for (const componentId of componentIds) {
      const component = componentIdToDetectedComponent[componentId];
      if (!component) {
        const { filePath, name } = decodeComponentId(componentId);
        throw new Error(`Component ${name} not detected in ${filePath}.`);
      }
      if (component.info.kind === "component") {
        analyze = component.info.analyze;
      } else {
        analyze =
          component.info.associatedComponent?.analyze ||
          (() =>
            Promise.resolve({
              propsType: UNKNOWN_TYPE,
              types: {},
            }));
      }
      logger.debug(`Analyzing ${component.info.kind}: ${componentId}`);
      const { propsType: props, types: componentTypes } = await analyze();
      logger.debug(`Done analyzing: ${componentId}`);
      components[componentId] = {
        info:
          component.info.kind === "component"
            ? {
                kind: "component",
                exported: component.info.exported,
              }
            : {
                kind: "story",
                args: component.info.args,
                associatedComponentId:
                  component.info.associatedComponent?.componentId || null,
              },
        props,
      };
      types = { ...types, ...componentTypes };
    }
    return {
      components,
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
    rootDirPath,
    // TODO: Use a cleaner approach.
    previewDirPath: path.join(
      path.dirname(path.dirname(require.resolve("@previewjs/iframe"))),
      "preview"
    ),
    frameworkPlugin,
    logger,
    middlewares,
    onFileChanged: (absoluteFilePath) => {
      const filePath = path.relative(rootDirPath, absoluteFilePath);
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
    rootDirPath,
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
      // TODO: Consider exposing a dispose() method on FrameworkPlugin instead.
      //
      // We may also want to reuse FrameworkPlugin for multiple workspaces, in which case
      // dispose() should not be called here?
      frameworkPlugin.typeAnalyzer.dispose();
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
  rootDirPath: string;
  reader: Reader;
  typeAnalyzer: TypeAnalyzer;
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
