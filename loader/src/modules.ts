import type * as core from "@previewjs/core";
import type * as vfs from "@previewjs/vfs";
import { execaCommand } from "execa";
import fs from "fs";
import path from "path";
import url from "url";

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
    const pnpmProcess = execaCommand(
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
  const coreModule: typeof core = await importModule("@previewjs/core");
  const vfsModule: typeof vfs = await importModule("@previewjs/vfs");
  const setupEnvironment: core.SetupPreviewEnvironment = await importModule(
    packageName
  );
  const frameworkPluginFactories: core.FrameworkPluginFactory[] = [
    await importModule("@previewjs/plugin-preact"),
    await importModule("@previewjs/plugin-react"),
    await importModule("@previewjs/plugin-solid"),
    await importModule("@previewjs/plugin-svelte"),
    await importModule("@previewjs/plugin-vue2"),
    await importModule("@previewjs/plugin-vue3"),
  ];

  async function importModule(name: string) {
    try {
      const module = await import(
        // TODO: Remove the hardcoded subpath.
        url
          .pathToFileURL(
            path.join(installDir, "node_modules", name, "dist", "index.mjs")
          )
          .toString()
      );
      return module.default || module;
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
