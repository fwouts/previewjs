import type * as core from "@previewjs/core";
import { chmodSync, constants, existsSync, lstatSync, readdirSync } from "fs";
import path from "path";

export function loadModules({
  installDir,
  packageName,
  logError = true,
}: {
  installDir: string;
  packageName: string;
  logError?: boolean;
}) {
  const core = requireModule("@previewjs/core");
  const vfs = requireModule("@previewjs/vfs");
  const setupEnvironment: core.SetupPreviewEnvironment =
    requireModule(packageName);
  const frameworkPluginFactories: core.FrameworkPluginFactory[] = [
    requireModule("@previewjs/plugin-react").default,
    requireModule("@previewjs/plugin-solid").default,
    requireModule("@previewjs/plugin-vue2").default,
    requireModule("@previewjs/plugin-vue3").default,
  ];

  function requireModule(name: string) {
    try {
      return require(require.resolve(name, {
        paths: [installDir],
      }));
    } catch (e) {
      if (logError) {
        console.error(`Unable to load ${name} from ${installDir}`, e);
      }
      throw e;
    }
  }

  for (const f of readdirSync(path.join(installDir, "node_modules"))) {
    if (f.startsWith("esbuild-")) {
      const binPath = path.join(__dirname, "node_modules", f, "bin", "esbuild");
      if (
        existsSync(binPath) &&
        !(lstatSync(binPath).mode & constants.S_IXUSR)
      ) {
        chmodSync(binPath, "555");
      }
    }
  }

  return {
    core,
    vfs,
    setupEnvironment,
    frameworkPluginFactories,
  };
}
