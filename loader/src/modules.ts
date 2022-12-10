import type * as core from "@previewjs/core";
import type * as vfs from "@previewjs/vfs";
import execa from "execa";
import fs from "fs";
import path from "path";

export async function loadModules({
  installDir,
  packageName,
}: {
  installDir: string;
  packageName: string;
}) {
  if (
    fs.existsSync(path.join(installDir, "pnpm")) &&
    !fs.existsSync(path.join(installDir, "node_modules"))
  ) {
    console.log("[install:begin] Running pnpm install...");
    const pnpmProcess = execa.command(
      `cd "${installDir}" && node pnpm/bin/pnpm.cjs install --frozen-lockfile`,
      {
        shell: true,
      }
    );
    pnpmProcess.stdout?.on("data", (chunk) => process.stdout.write(chunk));
    pnpmProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    await pnpmProcess;
    console.log("[install:end] Done.");
  }
  const coreModule = requireModule("@previewjs/core") as typeof core;
  const vfsModule = requireModule("@previewjs/vfs") as typeof vfs;
  const setupEnvironment: core.SetupPreviewEnvironment =
    requireModule(packageName);
  const frameworkPluginFactories: core.FrameworkPluginFactory[] = [
    requireModule("@previewjs/plugin-preact"),
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
