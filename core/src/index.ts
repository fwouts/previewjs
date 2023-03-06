import { RequestOf, ResponseOf, RPC, RPCs } from "@previewjs/api";
import { CollectedTypes, createTypeAnalyzer } from "@previewjs/type-analyzer";
import type { Reader } from "@previewjs/vfs";
import express from "express";
import fs from "fs-extra";
import getPort from "get-port";
import { createRequire } from "module";
import path from "path";
import type * as vite from "vite";
import {
  detectComponents,
  detectedComponentToApiComponent,
} from "./detect-components";
import type { ComponentAnalysis, FrameworkPlugin } from "./plugins/framework";
import type { SetupPreviewEnvironment } from "./preview-env";
import { Previewer } from "./previewer";
import { ApiRouter } from "./router";
export type { PackageDependencies } from "./plugins/dependencies";
export type {
  Component,
  ComponentAnalysis,
  ComponentTypeInfo,
  FrameworkPlugin,
  FrameworkPluginFactory,
} from "./plugins/framework";
export { setupFrameworkPlugin } from "./plugins/setup-framework-plugin";
export type { SetupPreviewEnvironment } from "./preview-env";

const require = createRequire(import.meta.url);

process.on("uncaughtException", (e) => {
  console.error("Uncaught Exception:", e);
});

export async function createWorkspace({
  rootDirPath,
  reader,
  frameworkPlugin,
  logLevel,
  setupEnvironment,
}: {
  rootDirPath: string;
  frameworkPlugin: FrameworkPlugin;
  logLevel: vite.LogLevel;
  reader: Reader;
  setupEnvironment?: SetupPreviewEnvironment;
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
    reader = frameworkPlugin.transformReader(reader);
  }
  const collected: CollectedTypes = {};
  const typeAnalyzer = createTypeAnalyzer({
    reader,
    rootDirPath,
    collected,
    specialTypes: frameworkPlugin.specialTypes,
    tsCompilerOptions: frameworkPlugin.tsCompilerOptions,
    printWarnings: logLevel === "info",
  });
  const router = new ApiRouter();
  router.registerRPC(RPCs.ComputeProps, async ({ filePath, componentName }) => {
    let analyze: () => Promise<ComponentAnalysis>;
    const component = (
      await frameworkPlugin.detectComponents(reader, typeAnalyzer, [
        path.join(rootDirPath, filePath),
      ])
    ).find((c) => c.name === componentName);
    if (!component) {
      throw new Error(`Component ${componentName} not detected in ${filePath}`);
    }
    if (component.info.kind === "component") {
      analyze = component.info.analyze;
    } else {
      analyze = component.info.associatedComponent.analyze;
    }
    const result = await analyze();
    return {
      component: detectedComponentToApiComponent(rootDirPath, component),
      types: {
        props: result.propsType,
        all: result.types,
      },
    };
  });
  router.registerRPC(RPCs.DetectComponents, (options) =>
    detectComponents(workspace, frameworkPlugin, typeAnalyzer, options)
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
    logLevel,
    middlewares,
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
