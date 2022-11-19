import type * as core from "@previewjs/core";
import type * as vfs from "@previewjs/vfs";
import execa from "execa";

export async function loadModules({
  installDir,
  packageName,
}: {
  installDir: string;
  packageName: string;
}) {
  console.log("Running pnpm install");
  await execa.command(
    `cd "${installDir}" && ./pnpm/bin/pnpm.cjs install --frozen-lockfile`,
    {
      shell: true,
      stdout: "inherit",
      stderr: "inherit",
    }
  );
  const coreModule = requireModule("@previewjs/core") as typeof core;
  const vfsModule = requireModule("@previewjs/vfs") as typeof vfs;
  const setupEnvironment: core.SetupPreviewEnvironment =
    requireModule(packageName);
  const frameworkPluginFactories: core.FrameworkPluginFactory[] = [
    requireModule("@previewjs/plugin-react"),
    requireModule("@previewjs/plugin-solid"),
    requireModule("@previewjs/plugin-svelte"),
    requireModule("@previewjs/plugin-vue2"),
    requireModule("@previewjs/plugin-vue3"),
  ];

  function requireModule(name: string) {
    try {
      return require(require.resolve(name, {
        paths: [installDir],
      }));
    } catch (e) {
      console.error(`Unable to load ${name} from ${installDir}`, e);
      throw e;
    }
  }

  return {
    core: coreModule,
    vfs: vfsModule,
    setupEnvironment,
    frameworkPluginFactories,
  };
}
