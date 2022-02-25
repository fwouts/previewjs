import type * as core from "@previewjs/core";
import type * as vfs from "@previewjs/vfs";
import { LogLevel } from ".";
import { locking } from "./locking";

export async function load({
  installDir,
  packageName,
}: {
  installDir: string;
  packageName: string;
}) {
  const core = requireModule("@previewjs/core");
  const vfs = requireModule("@previewjs/vfs");
  const setupEnvironment: core.SetupPreviewEnvironment =
    requireModule(packageName).default;

  function requireModule(name: string) {
    try {
      return require(require.resolve(name, {
        paths: [installDir],
      }));
    } catch (e) {
      console.error(`Unable to load ${name} from ${installDir}`);
      throw e;
    }
  }

  return init(core, vfs, setupEnvironment);
}

export async function init(
  coreModule: typeof core,
  vfsModule: typeof vfs,
  setupEnvironment: core.SetupPreviewEnvironment
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
