import execa from "execa";
import { mkdir, pathExists, writeFile } from "fs-extra";
import path from "path";
import lockfile from "proper-lockfile";
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
  // Prevent several processes from trying to install concurrently.
  const raceConditionLock = __dirname;
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
    try {
      const nodeVersionProcess = await execa("node", ["-v"], {
        cwd: options.installDir,
        reject: false,
      });
      if (nodeVersionProcess.failed) {
        throw new Error(
          `Preview.js was unable to run node.\n\nIs it installed? You may need to restart your IDE.`
        );
      }
      if (nodeVersionProcess.exitCode !== 0) {
        throw new Error(
          `Preview.js was unable to run node (exit code ${nodeVersionProcess.exitCode}):\n\n${nodeVersionProcess.stderr}`
        );
      }
      const nodeVersion = nodeVersionProcess.stdout;
      if (parseInt(nodeVersion) < 14) {
        throw new Error(
          `Preview.js needs NodeJS 14+ to run, but current version is: ${nodeVersion}\n\nPlease upgrade then restart your IDE.`
        );
      }
      const npmVersionProcess = await execa("npm", ["-v"], {
        cwd: options.installDir,
        reject: false,
      });
      if (npmVersionProcess.failed) {
        throw new Error(
          `Preview.js was unable to run npm.\n\nYou can manually run "npm install" in ${options.installDir}\n\nYou will need to restart your IDE after doing so.`
        );
      }
      if (npmVersionProcess.exitCode !== 0) {
        throw new Error(
          `Preview.js was unable to run npm (exit code ${npmVersionProcess.exitCode}):\n\n${npmVersionProcess.stderr}\n\nYou can manually run "npm install" in ${options.installDir}\n\nYou will need to restart your IDE after doing so.`
        );
      }
      const npmVersion = npmVersionProcess.stdout;
      if (parseInt(npmVersion) < 6) {
        throw new Error(
          `Preview.js needs npm 6+ to run, but current version is: ${npmVersion}\n\nPlease upgrade then restart your IDE.`
        );
      }
    } catch (e) {
      options.onOutput(`${e}`);
      throw e;
    }
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
