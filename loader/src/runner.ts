import type * as core from "@previewjs/core";
import { LogLevel } from ".";
import { locking } from "./locking";

export async function load({
  installDir,
  packageName,
}: {
  installDir: string;
  packageName: string;
}) {
  const core = await requireModule("@previewjs/core");
  const setupEnvironment: core.SetupPreviewEnvironment = (
    await requireModule(packageName)
  ).default;

  async function requireModule(name: string) {
    try {
      return import(
        /* webpackIgnore: true */
        __non_webpack_require__.resolve(name, {
          paths: [installDir],
        })
      );
    } catch (e) {
      console.error(`Unable to load ${name} from ${installDir}`);
      throw e;
    }
  }

  return init(core, setupEnvironment);
}

export async function init(
  coreModule: typeof core,
  setupEnvironment: core.SetupPreviewEnvironment
) {
  const memoryReader = coreModule.vfs.createMemoryReader();
  const reader = coreModule.vfs.createStackedReader([
    memoryReader,
    coreModule.vfs.createFileSystemReader({
      watch: true,
    }),
  ]);
  const workspaces: {
    [rootDirPath: string]: core.Workspace | null;
  } = {};

  return {
    updateFileInMemory(filePath: string, text: string | null) {
      memoryReader.updateFile(filePath, text);
    },
    async getWorkspace({
      versionCode,
      logLevel,
      filePath,
    }: {
      versionCode: string;
      logLevel: LogLevel;
      filePath: string;
    }) {
      const rootDirPath = coreModule.findWorkspaceRoot(filePath);
      let workspace = workspaces[rootDirPath];
      if (workspace === undefined) {
        workspace = workspaces[rootDirPath] = await locking(async () => {
          const loaded = await coreModule.loadPreviewEnv({
            rootDirPath,
            setupEnvironment,
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
            persistedStateManager: previewEnv.persistedStateManager,
            onReady: previewEnv.onReady?.bind(previewEnv),
          });
        });
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
      return Promise.all(promises);
    },
  };
}
