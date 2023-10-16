import type * as core from "@previewjs/core";
import type * as vfs from "@previewjs/vfs";
import { execaCommand } from "execa";
import fs from "fs";
import path from "path";
import type { Logger } from "pino";
import url from "url";

export async function loadModules({
  logger,
  installDir,
  onServerStartModuleName,
}: {
  logger: Logger;
  installDir: string;
  onServerStartModuleName?: string;
}) {
  if (
    fs.existsSync(path.join(installDir, "pnpm")) &&
    !fs.existsSync(path.join(installDir, "node_modules"))
  ) {
    // Note: The bracketed tag is required for VS Code and IntelliJ to detect start of installation.
    process.stdout.write("[install:begin] Running pnpm install...\n");
    const pnpmProcess = execaCommand(
      `cd "${installDir}" && node pnpm/bin/pnpm.cjs install --frozen-lockfile`,
      {
        shell: true,
      }
    );
    pnpmProcess.stdout?.on("data", (chunk) => process.stdout.write(chunk));
    pnpmProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    const pnpmResult = await pnpmProcess;
    if (pnpmResult.failed || pnpmResult.exitCode !== 0) {
      throw new Error(`Unable to install dependencies`);
    }
    // Note: The bracketed tag is required for VS Code and IntelliJ to detect end of installation.
    process.stdout.write("[install:end] Done.\n");
  }
  const coreModule: typeof core = await importModule("@previewjs/core");
  const vfsModule: typeof vfs = await importModule("@previewjs/vfs");
  const frameworkPlugins: core.FrameworkPluginFactory[] = [
    await importModule("@previewjs/plugin-solid"),
    await importModule("@previewjs/plugin-svelte"),
    await importModule("@previewjs/plugin-vue2"),
    await importModule("@previewjs/plugin-vue3"),
    await importModule("@previewjs/plugin-preact"),
    await importModule("@previewjs/plugin-react"),
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
      logger.fatal(`Unable to load ${name} from ${installDir}`, e);
      throw e;
    }
  }

  return {
    core: coreModule,
    vfs: vfsModule,
    onServerStart:
      onServerStartModuleName && (await importModule(onServerStartModuleName)),
    frameworkPlugins,
  };
}
