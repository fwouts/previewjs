import { RequestOf, ResponseOf, RPC, RPCs } from "@previewjs/api";
import {
  CollectedTypes,
  createTypeAnalyzer,
  EMPTY_OBJECT_TYPE,
  UNKNOWN_TYPE,
} from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import cookieParser from "cookie-parser";
import express from "express";
import fs from "fs-extra";
import getPort from "get-port";
import path from "path";
import type * as vite from "vite";
import { detectComponents } from "./detect-components";
import {
  LocalFilePersistedStateManager,
  PersistedStateManager,
} from "./persisted-state";
import type { FrameworkPlugin } from "./plugins/framework";
import { Previewer } from "./previewer";
import { ApiRouter, RegisterRPC } from "./router";
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

process.on("uncaughtException", (e) => {
  console.error("Uncaught Exception:", e);
});

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
  onReady?(options: {
    registerRPC: RegisterRPC;
    workspace: Workspace;
  }): Promise<void>;
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
  router.registerRPC(RPCs.GetInfo, async () => {
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
  router.registerRPC(RPCs.ComputeProps, async ({ filePath, componentName }) => {
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
      };
    }
    if (component.info.kind === "story") {
      return {
        types: {
          props: EMPTY_OBJECT_TYPE,
          all: {},
        },
      };
    }
    const result = await component.info.analyze();
    return {
      types: {
        props: result.propsType,
        all: result.types,
      },
    };
  });
  router.registerRPC(RPCs.DetectComponents, (options) =>
    detectComponents(workspace, frameworkPlugin, typeAnalyzer, options)
  );
  const previewer = new Previewer({
    reader,
    rootDirPath,
    // TODO: Use a cleaner approach.
    previewDirPath: path.join(
      path.dirname(path.dirname(require.resolve("@previewjs/iframe"))),
      "preview"
    ),
    frameworkPlugin,
    logLevel,
    middlewares: [
      express.json(),
      cookieParser(),
      express
        .Router()
        .use(
          "/monaco-editor",
          express.static(path.join(__dirname, "monaco-editor"))
        ),
      async (req, res, next) => {
        if (req.path === "/api/" + RPCs.GetState.path) {
          res.json(await persistedStateManager.get(req));
        } else if (req.path === "/api/" + RPCs.UpdateState.path) {
          res.json(await persistedStateManager.update(req, res));
        } else if (req.path.startsWith("/api/")) {
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
    async localRpc<E extends RPC<any, any>>(
      endpoint: E,
      request: RequestOf<E>
    ): Promise<ResponseOf<E>> {
      const result = await router.handle(endpoint.path, request);
      if (result.kind === "success") {
        return result.response as ResponseOf<E>;
      }
      throw new Error(result.message);
    },
    dispose: async () => {
      typeAnalyzer.dispose();
    },
  };
  if (onReady) {
    await onReady({
      registerRPC: (endpoint, handler) => router.registerRPC(endpoint, handler),
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
    if (
      fs.existsSync(path.join(dirPath, "package.json")) &&
      fs.existsSync(path.join(dirPath, "node_modules"))
    ) {
      return dirPath;
    }
    dirPath = path.dirname(dirPath);
  }
  return null;
}

export interface Workspace {
  rootDirPath: string;
  reader: Reader;
  preview: {
    start(allocatePort?: () => Promise<number>): Promise<Preview>;
  };
  localRpc<E extends RPC<any, any>>(
    endpoint: E,
    request: RequestOf<E>
  ): Promise<ResponseOf<E>>;
  dispose(): Promise<void>;
}

export interface Preview {
  url(): string;
  stop(options?: { onceUnused?: boolean }): Promise<void>;
}
