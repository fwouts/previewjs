import type * as core from "@previewjs/core";
import type * as vfs from "@previewjs/vfs";
import path from "path";
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
  const frameworkPluginFactories: core.FrameworkPluginFactory[] = [
    requireModule("@previewjs/plugin-react").reactFrameworkPlugin,
    requireModule("@previewjs/plugin-solid").solidFrameworkPlugin,
    requireModule("@previewjs/plugin-vue2").vue2FrameworkPlugin,
    requireModule("@previewjs/plugin-vue3").vue3FrameworkPlugin,
  ];

  function requireModule(name: string) {
    try {
      return require(require.resolve(name, {
        paths: [installDir, path.join(installDir, "node_modules", packageName)],
      }));
    } catch (e) {
      console.error(`Unable to load ${name} from ${installDir}`);
      throw e;
    }
  }

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
    }: {
      versionCode: string;
      logLevel: LogLevel;
      absoluteFilePath: string;
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
            persistedStateManager: previewEnv.persistedStateManager,
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
