import type * as core from "@previewjs/core";
import path from "path";

export async function loadModules({
  installDir,
  packageName,
  logError = true,
}: {
  installDir: string;
  packageName: string;
  logError?: boolean;
}) {
  const core = await requireModule("@previewjs/core");
  const vfs = await requireModule("@previewjs/vfs");
  const setupEnvironment: core.SetupPreviewEnvironment = await requireModule(
    packageName
  );
  const frameworkPluginFactories: core.FrameworkPluginFactory[] = [
    (await requireModule("@previewjs/plugin-react")).default,
    (await requireModule("@previewjs/plugin-solid")).default,
    (await requireModule("@previewjs/plugin-svelte", true)).default,
    (await requireModule("@previewjs/plugin-vue2")).default,
    (await requireModule("@previewjs/plugin-vue3")).default,
  ];

  async function requireModule(name: string, esm = false) {
    try {
      if (esm) {
        // TODO: Don't hardcode the full path to the module.
        return import(
          path.join(installDir, "node_modules", name, "dist", "index.mjs")
        );
      } else {
        return require(require.resolve(name, {
          paths: [installDir],
        }));
      }
    } catch (e) {
      if (logError) {
        console.error(`Unable to load ${name} from ${installDir}`, e);
      }
      throw e;
    }
  }

  return {
    core,
    vfs,
    setupEnvironment,
    frameworkPluginFactories,
  };
}
