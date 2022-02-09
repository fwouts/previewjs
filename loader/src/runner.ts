import type * as core from "@previewjs/core";
import { LogLevel, SetupPreviewEnvironment } from ".";
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
    coreModule.vfs.createFileSystemReader(),
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
            versionCode,
            logLevel,
            reader,
          });
          if (!previewEnv) {
            return null;
          }
          return await coreModule.createWorkspace({
            versionCode,
            logLevel,
            rootDirPath,
            reader: previewEnv.reader || reader,
            frameworkPlugin: previewEnv.frameworkPlugin,
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
