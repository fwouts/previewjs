import type * as core from "@previewjs/core";
import type * as vfs from "@previewjs/vfs";
import { exclusivePromiseRunner } from "exclusive-promises";
import type { LogLevel } from ".";
import { loadModules } from "./modules";

const locking = exclusivePromiseRunner();

export async function load(options: {
  installDir: string;
  packageName: string;
}) {
  const { core, vfs, setupEnvironment, frameworkPluginFactories } =
    loadModules(options);
  return init(core, vfs, setupEnvironment, frameworkPluginFactories);
}

export async function init(
  coreModule: typeof core,
  vfsModule: typeof vfs,
  setupEnvironment: core.SetupPreviewEnvironment,
  frameworkPluginFactories?: core.FrameworkPluginFactory[]
) {
  const memoryReader = vfsModule.createMemoryReader();
  const reader = vfsModule.createStackedReader([
    memoryReader,
    vfsModule.createFileSystemReader({
      watch: true,
    }),
  ]);
  const workspaces: {
    [rootDirPath: string]: core.Workspace | null;
  } = {};

  return {
    core: coreModule,
    updateFileInMemory(absoluteFilePath: string, text: string | null) {
      memoryReader.updateFile(absoluteFilePath, text);
    },
    async getWorkspace({
      versionCode,
      logLevel,
      absoluteFilePath,
      persistedStateManager,
    }: {
      versionCode: string;
      logLevel: LogLevel;
      absoluteFilePath: string;
      persistedStateManager?: core.PersistedStateManager;
    }) {
      const rootDirPath = coreModule.findWorkspaceRoot(absoluteFilePath);
      if (!rootDirPath) {
        return null;
      }
      let workspace = workspaces[rootDirPath];
      if (workspace === undefined) {
        const created = await locking(async () => {
          const loaded = await coreModule.loadPreviewEnv({
            rootDirPath,
            setupEnvironment,
            frameworkPluginFactories,
          });
          if (!loaded) {
            return null;
          }
          const { previewEnv, frameworkPlugin } = loaded;
          return await coreModule.createWorkspace({
            versionCode,
            logLevel,
            rootDirPath,
            reader,
            frameworkPlugin,
            middlewares: previewEnv.middlewares || [],
            persistedStateManager:
              persistedStateManager || previewEnv.persistedStateManager,
            onReady: previewEnv.onReady?.bind(previewEnv),
          });
        });
        workspace = workspaces[rootDirPath] = created
          ? {
              ...created,
              dispose: async () => {
                delete workspaces[rootDirPath];
                await created.dispose();
              },
            }
          : null;
      }
      return workspace;
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
