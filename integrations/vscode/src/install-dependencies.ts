import { install, isInstalled } from "@previewjs/loader";
import type { OutputChannel } from "vscode";
import { getLoaderInstallDir } from "./loader-install-dir";

export async function installDependenciesIfNeeded(
  outputChannel: OutputChannel
) {
  const packageName = process.env.PREVIEWJS_PACKAGE_NAME;
  if (!packageName) {
    throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
  }

  let requirePath = process.env.PREVIEWJS_MODULES_DIR;
  if (!requirePath) {
    requirePath = getLoaderInstallDir();
    if (!(await isInstalled({ installDir: requirePath, packageName }))) {
      let showing = false;
      await install({
        installDir: requirePath,
        packageName,
        onOutput: (chunk) => {
          if (!showing) {
            outputChannel.show();
            showing = true;
          }
          outputChannel.append(chunk);
        },
      });
    }
  }
}
