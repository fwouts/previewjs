import { readConfig } from "@previewjs/config";
import { RequestHandler } from "express";
import fs from "fs-extra";
import path from "path";
import {
  FrameworkPlugin,
  FrameworkPluginFactory,
  PersistedStateManager,
  Workspace,
} from ".";
import { PackageDependencies } from "./plugins/dependencies";
import { ApiRouter } from "./router";

export type SetupPreviewEnvironment = (options: {
  rootDirPath: string;
}) => Promise<PreviewEnvironment>;

export type PreviewEnvironment = {
  middlewares?: RequestHandler[];
  persistedStateManager?: PersistedStateManager;
  onReady?(options: { router: ApiRouter; workspace: Workspace }): Promise<void>;
};

export async function loadPreviewEnv({
  rootDirPath,
  setupEnvironment,
  frameworkPluginFactories,
}: {
  rootDirPath: string;
  setupEnvironment: SetupPreviewEnvironment;
  frameworkPluginFactories?: FrameworkPluginFactory[];
}) {
  const previewEnv = await setupEnvironment({ rootDirPath });
  let frameworkPlugin: FrameworkPlugin | undefined = await readConfig(
    rootDirPath
  ).frameworkPlugin;
  fallbackToDefault: if (!frameworkPlugin) {
    const dependencies = await extractPackageDependencies(rootDirPath);
    for (const candidate of frameworkPluginFactories || []) {
      if (await candidate.isCompatible(dependencies)) {
        frameworkPlugin = await candidate.create();
        break fallbackToDefault;
      }
    }
    return null;
  }
  return {
    previewEnv,
    frameworkPlugin,
  };
}

async function extractPackageDependencies(
  rootDirPath: string
): Promise<PackageDependencies> {
  const packageJsonPath = path.join(rootDirPath, "package.json");
  if (!(await fs.pathExists(packageJsonPath))) {
    return {};
  }
  let { dependencies, devDependencies } = JSON.parse(
    await fs.readFile(packageJsonPath, "utf8")
  );
  const allDependencies = {
    ...dependencies,
    ...devDependencies,
  };
  return Object.fromEntries(
    Object.entries(allDependencies).map(
      ([name, version]): [string, PackageDependencies[string]] => {
        let majorVersion: number;
        if (typeof version !== "string") {
          majorVersion = 0;
        } else if (version.startsWith("^") || version.startsWith("~")) {
          majorVersion = parseInt(version.slice(1));
        } else {
          majorVersion = parseInt(version);
        }
        const readInstalledVersion = async () => {
          try {
            const moduleEntryPath = require.resolve(name, {
              paths: [rootDirPath],
            });
            let packagePath = moduleEntryPath;
            let packageJsonPath: string | null = null;
            while (packagePath !== path.dirname(packagePath)) {
              const candidatePackageJsonPath = path.join(
                packagePath,
                "package.json"
              );
              if (fs.existsSync(candidatePackageJsonPath)) {
                packageJsonPath = candidatePackageJsonPath;
                break;
              }
              packagePath = path.dirname(packagePath);
            }
            if (!packageJsonPath) {
              throw new Error(
                `No package.json path found from: ${moduleEntryPath}`
              );
            }
            const packageInfo = JSON.parse(
              await fs.readFile(packageJsonPath, "utf8")
            );
            const version = packageInfo["version"];
            if (!version || typeof version !== "string") {
              throw new Error(
                `Invalid version found for package: ${packageJsonPath}`
              );
            }
            return version;
          } catch (e) {
            console.error(
              `Unable to read installed version of package: ${name}`,
              e
            );
            return null;
          }
        };
        return [name, { majorVersion, readInstalledVersion }];
      }
    )
  );
}
