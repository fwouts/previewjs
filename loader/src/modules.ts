import type * as core from "@previewjs/core";

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

  return {
    core,
    vfs,
    setupEnvironment,
    frameworkPluginFactories,
  };
}
