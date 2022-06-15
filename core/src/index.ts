import { localEndpoints } from "@previewjs/api";
import {
  CollectedTypes,
  createTypeAnalyzer,
  TypeAnalyzer,
  UNKNOWN_TYPE,
} from "@previewjs/type-analyzer";
import { Reader } from "@previewjs/vfs";
import cookieParser from "cookie-parser";
import express from "express";
import fs from "fs-extra";
import getPort from "get-port";
import path from "path";
import * as vite from "vite";
import { analyzeProject, ProjectAnalysis } from "./analyze-project";
import { computeProps } from "./compute-props";
import {
  LocalFilePersistedStateManager,
  PersistedStateManager,
} from "./persisted-state";
import { FrameworkPlugin } from "./plugins/framework";
import { Previewer } from "./previewer";
import { ApiRouter } from "./router";
export type { ProjectAnalysis } from "./analyze-project";
export { generateComponentId } from "./component-id";
export type { PersistedStateManager } from "./persisted-state";
export type {
  Component,
  ComponentAnalysis,
  FrameworkPlugin,
  FrameworkPluginFactory,
} from "./plugins/framework";
export { loadPreviewEnv } from "./preview-env";
export type {
  PreviewEnvironment,
  SetupPreviewEnvironment,
} from "./preview-env";

export async function createWorkspace({
  versionCode,
  rootDirPath,
  reader,
  frameworkPlugin,
  logLevel,
  middlewares,
  onReady,
  persistedStateManager = new LocalFilePersistedStateManager(),
}: {
  versionCode: string;
  rootDirPath: string;
  middlewares: express.RequestHandler[];
  frameworkPlugin: FrameworkPlugin;
  logLevel: vite.LogLevel;
  reader: Reader;
  persistedStateManager?: PersistedStateManager;
  onReady?(options: { router: ApiRouter; workspace: Workspace }): Promise<void>;
}): Promise<Workspace> {
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
    reader = frameworkPlugin.transformReader(reader, rootDirPath);
  }
  const collected: CollectedTypes = {};
  const typeAnalyzer = createTypeAnalyzer({
    reader,
    rootDirPath,
    collected,
    specialTypes: frameworkPlugin.specialTypes,
    tsCompilerOptions: frameworkPlugin.tsCompilerOptions,
  });
  const router = new ApiRouter();
  router.onRequest(localEndpoints.GetInfo, async () => {
    const separatorPosition = versionCode.indexOf("-");
    if (separatorPosition === -1) {
      throw new Error(`Unsupported version code format: ${versionCode}`);
    }
    const platform = versionCode.substr(0, separatorPosition);
    const version = versionCode.substr(separatorPosition + 1);
    return {
      appInfo: {
        platform,
        version,
      },
    };
  });
  router.onRequest(localEndpoints.GetState, persistedStateManager.get);
  router.onRequest(localEndpoints.UpdateState, persistedStateManager.update);
  router.onRequest(
    localEndpoints.ComputeProps,
    async ({ filePath, componentName }) => {
      const component = (
        await frameworkPlugin.detectComponents(typeAnalyzer, [
          path.join(rootDirPath, filePath),
        ])
      ).find((c) => c.name === componentName);
      if (!component) {
        return {
          types: {
            props: UNKNOWN_TYPE,
            all: {},
          },
          args: [],
        };
      }
      return computeProps({
        component,
      });
    }
  );
  const previewer = new Previewer({
    reader,
    rootDirPath,
    previewDirPath: path.join(__dirname, "..", "..", "iframe", "preview"),
    frameworkPlugin,
    logLevel,
    middlewares: [
      express.json(),
      cookieParser(),
      express
        .Router()
        .use(
          "/monaco-editor",
          express.static(path.join(__dirname, "..", "monaco-editor"))
        ),
      async (req, res, next) => {
        if (req.path.startsWith("/api/")) {
          res.json(await router.handle(req.path.substr(5), req.body, req, res));
        } else {
          next();
        }
      },
      ...middlewares,
    ],
    onFileChanged: (absoluteFilePath) => {
      const filePath = path.relative(rootDirPath, absoluteFilePath);
      for (const name of Object.keys(collected)) {
        if (name.startsWith(`${filePath}:`)) {
          delete collected[name];
        }
      }
    },
  });
  const workspace: Workspace = {
    rootDirPath,
    reader,
    typeAnalyzer,
    frameworkPlugin,
    preview: {
      start: async (allocatePort) => {
        const port = await previewer.start(async () => {
          const port = allocatePort ? await allocatePort() : 0;
          return (
            port ||
            (await getPort({
              port: getPort.makeRange(3140, 4000),
            }))
          );
        });
        return {
          url: () => `http://localhost:${port}`,
          stop: async (options) => {
            await previewer.stop(options);
          },
        };
      },
    },
    components: {
      list: (options) => {
        return analyzeProject(workspace, options);
      },
    },
    dispose: async () => {
      typeAnalyzer.dispose();
    },
  };
  if (onReady) {
    await onReady({
      router,
      workspace,
    });
  }
  return workspace;
}

/**
 * Returns the absolute directory path of the closest ancestor containing node_modules.
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
  frameworkPlugin: FrameworkPlugin;
  preview: {
    start(allocatePort?: () => Promise<number>): Promise<Preview>;
  };
  components: {
    list(options?: { forceRefresh?: boolean }): Promise<ProjectAnalysis>;
  };
  dispose(): Promise<void>;
}

export interface Preview {
  url(): string;
  stop(options?: { onceUnused?: boolean }): Promise<void>;
}
