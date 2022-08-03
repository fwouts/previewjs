import execa from "execa";
import { mkdir, pathExists, writeFile } from "fs-extra";
import path from "path";
import lockfile from "proper-lockfile";
import { checkNodeVersion } from "./checkNodeVersion";
import { checkNpmVersion } from "./checkNpmVersion";
import { loadModules } from "./modules";
import packageLockJson from "./release/package-lock.json";
import packageJson from "./release/package.json";

export async function isInstalled({
  installDir,
  packageName,
}: {
  installDir: string;
  packageName: string;
}) {
  if (!(await pathExists(installDir))) {
    return false;
  }
  try {
    loadModules({
      installDir,
      packageName,
      logError: false,
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function install(options: {
  installDir: string;
  packageName: string;
  onOutput: (chunk: string) => void;
}) {
  await mkdir(options.installDir, { recursive: true });
  try {
    await checkNodeVersion(options.installDir);
    await checkNpmVersion(options.installDir);
  } catch (e) {
    options.onOutput(`${e}`);
    throw e;
  }
  // Prevent several processes from trying to install concurrently.
  const raceConditionLock = options.installDir;
  const lockOptions: lockfile.CheckOptions = {
    lockfilePath: path.join(options.installDir, "dir.lock"),
  };
  try {
    await lockfile.lock(raceConditionLock, lockOptions);
  } catch {
    while (await lockfile.check(raceConditionLock, lockOptions)) {
      // Wait a second before checking again.
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }
    // At this point it either succeeded or failed in the other workspace.
    // Note: For some reason, isInstalled() fails here at least in VS Code. Not sure why!
    return;
  }
  try {
    options.onOutput(
      "Please wait while Preview.js installs dependencies. This could take a minute.\n\n"
    );
    await writeFile(
      path.join(options.installDir, "package.json"),
      JSON.stringify(packageJson),
      "utf8"
    );
    await writeFile(
      path.join(options.installDir, "package-lock.json"),
      JSON.stringify(packageLockJson),
      "utf8"
    );
    options.onOutput(`$ npm install\n\n`);
    try {
      const installProcess = execa("npm", ["install"], {
        cwd: options.installDir,
        all: true,
      });
      installProcess.all?.on("data", (chunk) => {
        options.onOutput(
          typeof chunk === "string" ? chunk : chunk.toString("utf8")
        );
      });
      const { failed, isCanceled } = await installProcess;
      if (failed || isCanceled) {
        throw new Error(`Preview.js could not install dependencies`);
      }
      try {
        loadModules({
          ...options,
          logError: true,
        });
      } catch (e) {
        throw new Error(
          `npm install succeeded but @previewjs modules could not be loaded.\n\n${e}`
        );
      }
      options.onOutput(
        "\nPreview.js dependencies were installed successfully.\n\n"
      );
    } catch (e) {
      options.onOutput(`\nOh no, it looks like installation failed!\n\n${e}`);
      throw e;
    }
  } finally {
    await lockfile.unlock(raceConditionLock, lockOptions);
  }
}
