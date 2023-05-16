import type * as core from "@previewjs/core";
import { exclusivePromiseRunner } from "exclusive-promises";
import fs from "fs-extra";
import path from "path";
import createLogger from "pino";
import { loadModules } from "./modules.js";

const locking = exclusivePromiseRunner();

const validLogLevels = new Set<unknown>(["debug", "info", "error", "silent"]);

export async function load(options: {
  installDir: string;
  packageName: string;
}) {
  const { core, vfs, setupEnvironment, frameworkPlugins } = await loadModules(
    options
  );
  let logLevel = process.env["PREVIEWJS_LOG_LEVEL"]?.toLowerCase();
  if (!validLogLevels.has(logLevel)) {
    logLevel = "info";
  }
  const globalLogger = createLogger({ level: "debug" });
  const memoryReader = vfs.createMemoryReader();
  const reader = vfs.createStackedReader([
    memoryReader,
    vfs.createFileSystemReader({
      watch: true,
    }),
  ]);
  const workspaces: {
    [rootDirPath: string]: core.Workspace | null;
  } = {};

  return {
    core,
    updateFileInMemory(absoluteFilePath: string, text: string | null) {
      memoryReader.updateFile(absoluteFilePath, text);
    },
    async getWorkspace({
      versionCode,
      absoluteFilePath,
    }: {
      versionCode: string;
      absoluteFilePath: string;
    }) {
      const rootDirPath = core.findWorkspaceRoot(absoluteFilePath);
      if (!rootDirPath) {
        globalLogger.info(
          `No workspace root detected from ${absoluteFilePath}`
        );
        return null;
      }
      // TODO: Load a proper configuration file containing the desired log level.
      // Pending https://twitter.com/fwouts/status/1658288168238735361
      let logger = globalLogger;
      if (await fs.pathExists(path.join(rootDirPath, "previewjs-debug"))) {
        // Show debug logs for this workspace.
        logger = createLogger({ level: "debug" });
      }
      const existingWorkspace = workspaces[rootDirPath];
      if (existingWorkspace !== undefined) {
        return existingWorkspace;
      }
      const created = await locking(async () => {
        const frameworkPlugin = await core.setupFrameworkPlugin({
          rootDirPath,
          frameworkPlugins,
        });
        if (!frameworkPlugin) {
          logger.warn(
            `No compatible Preview.js plugin for workspace: ${rootDirPath}`
          );
          return null;
        }
        logger.info(
          `Creating Preview.js workspace (plugin: ${frameworkPlugin.name}) at ${rootDirPath}`
        );
        return await core.createWorkspace({
          logger,
          rootDirPath,
          reader,
          frameworkPlugin,
          setupEnvironment: (options) =>
            setupEnvironment({
              versionCode,
              ...options,
            }),
        });
      });
      // Note: This caches the incompatibility of a workspace (i.e. caching null), which
      // would be problematic especially when package.json is updated to a compatible
      // package version.
      // TODO: Find a smarter approach, perhaps checking last-modified time of package.json and node_modules.
      return (workspaces[rootDirPath] = created
        ? {
            ...created,
            dispose: async () => {
              delete workspaces[rootDirPath];
              await created.dispose();
            },
          }
        : null);
    },
    async dispose() {
      const promises: Array<Promise<void>> = [];
      for (const workspace of Object.values(workspaces)) {
        if (!workspace) {
          continue;
        }
        promises.push(workspace.dispose());
      }
      await Promise.all(promises);
    },
  };
}
