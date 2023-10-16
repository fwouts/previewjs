import type * as core from "@previewjs/core";
import { exclusivePromiseRunner } from "exclusive-promises";
import fs from "fs-extra";
import path from "path";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import { loadModules } from "./modules.js";

const locking = exclusivePromiseRunner();

const validLogLevels = new Set<unknown>(["debug", "info", "error", "silent"]);

export async function load({
  installDir,
  onServerStartModuleName,
}: {
  installDir: string;
  onServerStartModuleName?: string;
}) {
  let logLevel = process.env["PREVIEWJS_LOG_LEVEL"]?.toLowerCase();
  if (!validLogLevels.has(logLevel)) {
    logLevel = "info";
  }
  const prettyLoggerStream = prettyLogger({
    colorize: true,
    destination: process.stdout,
  });
  const globalLogger = createLogger({ level: logLevel }, prettyLoggerStream);
  const { core, vfs, onServerStart, frameworkPlugins } = await loadModules({
    logger: globalLogger,
    installDir,
    onServerStartModuleName,
  });
  const memoryReader = vfs.createMemoryReader();
  const fsReader = vfs.createFileSystemReader({
    watch: true,
  });
  fsReader.listeners.add({
    onChange(absoluteFilePath, info) {
      if (!info.virtual) {
        memoryReader.updateFile(absoluteFilePath, null);
      }
    },
  });
  const reader = vfs.createStackedReader([memoryReader, fsReader]);
  const workspaces: {
    [rootDir: string]: core.Workspace | null;
  } = {};

  return {
    core,
    logger: globalLogger,
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
      const rootDir = core.findWorkspaceRoot(absoluteFilePath);
      if (!rootDir) {
        globalLogger.info(
          `No workspace root detected from ${absoluteFilePath}`
        );
        return null;
      }
      // TODO: Load a proper configuration file containing the desired log level.
      // Pending https://twitter.com/fwouts/status/1658288168238735361
      let logger = globalLogger;
      if (await fs.pathExists(path.join(rootDir, "previewjs-debug"))) {
        // Show debug logs for this workspace.
        logger = createLogger({ level: "debug" }, prettyLoggerStream);
      }
      const existingWorkspace = workspaces[rootDir];
      if (existingWorkspace !== undefined) {
        return existingWorkspace;
      }
      const frameworkPluginName = await core.findCompatiblePlugin(
        logger,
        rootDir,
        frameworkPlugins
      );
      const frameworkPlugin = frameworkPlugins.find(
        (p) => p.info?.name === frameworkPluginName
      );
      if (!frameworkPlugin) {
        logger.warn(
          `No compatible plugin found for workspace with root: ${rootDir}`
        );
        return;
      }
      const created = await locking(async () => {
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
        return workspace;
      });
      // Note: This caches the incompatibility of a workspace (i.e. caching null), which
      // would be problematic especially when package.json is updated to a compatible
      // package version.
      // TODO: Find a smarter approach, perhaps checking last-modified time of package.json and node_modules.
      return (workspaces[rootDir] = created
        ? {
            ...created,
            dispose: async () => {
              delete workspaces[rootDir];
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
