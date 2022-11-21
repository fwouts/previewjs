import type * as core from "@previewjs/core";
import { exclusivePromiseRunner } from "exclusive-promises";
import { loadModules } from "./modules";

const locking = exclusivePromiseRunner();

export async function load(options: {
  installDir: string;
  packageName: string;
}) {
  const { core, vfs, setupEnvironment, frameworkPluginFactories } =
    await loadModules(options);
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
      persistedStateManager,
    }: {
      versionCode: string;
      absoluteFilePath: string;
      persistedStateManager?: core.PersistedStateManager;
    }) {
      const rootDirPath = core.findWorkspaceRoot(absoluteFilePath);
      if (!rootDirPath) {
        console.warn(`No workspace root detected from ${absoluteFilePath}`);
        return null;
      }
      const existingWorkspace = workspaces[rootDirPath];
      if (existingWorkspace !== undefined) {
        return existingWorkspace;
      }
      const created = await locking(async () => {
        const loaded = await core.loadPreviewEnv({
          rootDirPath,
          setupEnvironment,
          frameworkPluginFactories,
        });
        if (!loaded) {
          console.warn(
            `No compatible Preview.js plugin for workspace: ${rootDirPath}`
          );
          return null;
        }
        const { previewEnv, frameworkPlugin } = loaded;
        console.log(
          `Creating Preview.js workspace (plugin: ${frameworkPlugin.name}) at ${rootDirPath}`
        );
        return await core.createWorkspace({
          versionCode,
          logLevel: "info",
          rootDirPath,
          reader,
          frameworkPlugin,
          middlewares: previewEnv.middlewares || [],
          persistedStateManager:
            persistedStateManager || previewEnv.persistedStateManager,
          onReady: previewEnv.onReady?.bind(previewEnv),
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
