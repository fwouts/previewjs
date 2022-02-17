import { readConfig } from "@previewjs/config";
import type * as core from "@previewjs/core";
import { LogLevel, SetupPreviewEnvironment } from ".";
import { extractPackageDependencies } from "./dependencies";
import { locking } from "./locking";

export async function load({
  installDir,
  packageName,
}: {
  installDir: string;
  packageName: string;
}) {
  const core = requireModule("@previewjs/core");
  const setupEnvironment: SetupPreviewEnvironment =
    requireModule(packageName).default;

  function requireModule(name: string) {
    try {
      return __non_webpack_require__(
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
  setupEnvironment: SetupPreviewEnvironment
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
          const previewEnv = await setupEnvironment({
            rootDirPath,
          });
          if (!previewEnv) {
            return null;
          }
          let frameworkPlugin: core.FrameworkPlugin | undefined =
            await readConfig(rootDirPath).frameworkPlugin;
          fallbackToDefault: if (!frameworkPlugin) {
            const dependencies = await extractPackageDependencies(rootDirPath);
            for (const candidate of previewEnv.frameworkPluginFactories || []) {
              if (await candidate.isCompatible(dependencies)) {
                frameworkPlugin = await candidate.create();
                break fallbackToDefault;
              }
            }
            return null;
          }
          return await coreModule.createWorkspace({
            versionCode,
            logLevel,
            rootDirPath,
            reader,
            frameworkPlugin,
            middlewares: previewEnv.middlewares || [],
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
