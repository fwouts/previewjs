import { localEndpoints } from "@previewjs/api";
import {
  CollectedTypes,
  createTypeAnalyzer,
  TypeAnalyzer,
} from "@previewjs/type-analyzer";
import { Reader } from "@previewjs/vfs";
import express from "express";
import fs from "fs-extra";
import getPort from "get-port";
import path from "path";
import * as vite from "vite";
import { computeProps } from "./compute-props";
import { PersistedStateManager } from "./persisted-state";
import { FrameworkPlugin } from "./plugins/framework";
import { Previewer } from "./previewer";
import { ApiRouter } from "./router";
export { generateComponentId } from "./component-id";
export { PersistedStateManager } from "./persisted-state";
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
  persistedStateManager = new PersistedStateManager(),
}: {
  versionCode: string;
  rootDirPath: string;
  middlewares: express.RequestHandler[];
  frameworkPlugin: FrameworkPlugin;
  logLevel: vite.LogLevel;
  reader: Reader;
  persistedStateManager?: PersistedStateManager;
  onReady?(options: { router: ApiRouter; workspace: Workspace }): Promise<void>;
}): Promise<Workspace | null> {
  if (frameworkPlugin.pluginApiVersion !== 2) {
    throw new Error(
      `Detected incompatible Preview.js framework plugin. Please install latest version of ${frameworkPlugin.name}.`
    );
  }
  let cacheDirPath: string;
  try {
    const { version } = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "..", "..", "package.json"),
        "utf8"
      )
    );
    cacheDirPath = path.resolve(
      rootDirPath,
      "node_modules",
      ".previewjs",
      `v${version}`
    );
  } catch (e) {
    throw new Error(`Unable to detect @previewjs/core version.`);
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
  router.onRequest(localEndpoints.GetState, () => persistedStateManager.get());
  router.onRequest(localEndpoints.UpdateState, (stateUpdate) =>
    persistedStateManager.update(stateUpdate)
  );
  router.onRequest(
    localEndpoints.ComputeProps,
    async ({ filePath, componentName }) => {
      const component = (
        await frameworkPlugin.detectComponents(typeAnalyzer, [
          path.join(rootDirPath, filePath),
        ])
      ).find((c) => c.name === componentName);
      if (!component) {
        return null;
      }
      return computeProps({
        rootDirPath,
        component,
      });
    }
  );
  const previewer = new Previewer({
    reader,
    rootDirPath,
    previewDirPath: path.join(__dirname, "..", "..", "iframe", "preview"),
    cacheDirPath,
    frameworkPlugin,
    logLevel,
    middlewares: [
      express.json(),
      express
        .Router()
        .use(
          "/monaco-editor",
          express.static(path.join(__dirname, "..", "monaco-editor"))
        ),
      async (req, res, next) => {
        if (req.path.startsWith("/api/")) {
          res.json(await router.handle(req.path.substr(5), req.body));
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
  dispose(): Promise<void>;
}

export interface Preview {
  url(): string;
  stop(options?: { onceUnused?: boolean }): Promise<void>;
}
