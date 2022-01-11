import type * as core from "@previewjs/core";
import { ApiRouter } from "@previewjs/core/router";
import { TypescriptAnalyzer } from "@previewjs/core/ts-helpers";
import type { RequestHandler } from "express";
import path from "path";
import { ensureInstalled } from "./installer";
import { locking } from "./locking";

// Initialise __non_webpack_require__ for non-webpack environments.
if (!global.__non_webpack_require__) {
  global.__non_webpack_require__ = require;
}

export type SetupPreviewEnvironment = (options: {
  rootDirPath: string;
  versionCode: string;
  logLevel: LogLevel;
  reader: core.vfs.Reader;
  persistedStateManager?: core.PersistedStateManager;
}) => Promise<PreviewEnvironment | null>;

export type LogLevel = "silent" | "error" | "warn" | "info";

export type PreviewEnvironment = {
  frameworkPlugin: core.FrameworkPlugin;
  middlewares?: RequestHandler[];
  reader?: core.vfs.Reader;
  onReady?(options: {
    router: ApiRouter;
    typescriptAnalyzer: TypescriptAnalyzer;
  }): Promise<void>;
  onFileChanged?(filePath: string): Promise<void>;
};

export async function load({
  installDir,
  status,
}: {
  installDir: string;
  status: {
    info(message: string): void;
    error(message: string): void;
  };
}) {
  const packageName = process.env["PREVIEWJS_PACKAGE_NAME"];
  if (!packageName) {
    throw new Error(`Missing env variable: PREVIEWJS_PACKAGE_NAME`);
  }
  let requirePath = process.env["PREVIEWJS_MODULES_DIR"] || "";
  if (requirePath) {
    requirePath = path.resolve(requirePath);
  } else {
    const packageVersion = process.env["PREVIEWJS_PACKAGE_VERSION"];
    if (!packageVersion) {
      throw new Error(`Missing env variable: PREVIEWJS_PACKAGE_VERSION`);
    }
    await ensureInstalled({
      installDir,
      packageName,
      packageVersion,
      status,
    });
    requirePath = installDir;
  }
  const core = requireModule("@previewjs/core");
  const setupEnvironment: SetupPreviewEnvironment =
    requireModule(packageName).default;

  function requireModule(name: string) {
    try {
      return __non_webpack_require__(
        __non_webpack_require__.resolve(name, {
          paths: [requirePath],
        })
      );
    } catch (e) {
      console.error(`Unable to load ${name} from ${requirePath}`);
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
            onFileChanged: previewEnv.onFileChanged?.bind(previewEnv),
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
