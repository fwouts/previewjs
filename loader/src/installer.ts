import { exec } from "child_process";
import { unlinkSync } from "fs";
import { mkdir, pathExists, readFile, rm, writeFile } from "fs-extra";
import path from "path";

export interface InstallOptions {
  packageName: string;
  packageVersion: string;
  installDir: string;
  status: {
    info(message: string): void;
    error(message: string): void;
  };
}

export async function ensureInstalled(options: InstallOptions) {
  if (!(await isInstallRequired(options))) {
    return;
  }
  await installRequiredPackages(options);
}

async function isInstallRequired(options: InstallOptions) {
  const versionCachePath = installedVersionInfoPath(options);
  return (
    !(await pathExists(versionCachePath)) ||
    (await readFile(versionCachePath, "utf8")) !== versionId(options)
  );
}

const MAX_WAIT_SECONDS = 60;

async function installRequiredPackages(options: InstallOptions) {
  options.status.info("Please wait while Preview.js installs dependencies…");
  const singleInstallLockPack = path.join(
    options.installDir,
    "__install_lock__"
  );
  const packageJsonPath = path.join(options.installDir, "package.json");
  const expectedPackageLockPath = path.join(
    options.installDir,
    "package-lock.json"
  );
  if (await pathExists(singleInstallLockPack)) {
    // Wait until installation is successful in another process.
    const waitingSince = Date.now();
    while (!(await pathExists(expectedPackageLockPath))) {
      if (Date.now() - waitingSince > MAX_WAIT_SECONDS * 1000) {
        await rm(singleInstallLockPack);
        options.status.error(
          `Uh-oh. Unable to install Preview.js dependencies.`
        );
        throw new Error("Waiting too long for packages to be installed.");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    options.status.info("Preview.js is ready.");
    return;
  }
  await mkdir(options.installDir, { recursive: true });
  await writeFile(singleInstallLockPack, Date.now().toString(), "utf8");
  process.on("exit", () => {
    unlinkSync(singleInstallLockPack);
  });
  await writeFile(
    packageJsonPath,
    JSON.stringify({
      dependencies: {
        [options.packageName]: options.packageVersion,
      },
    })
  );
  return new Promise<void>((resolve, reject) => {
    exec(
      `npm install`,
      {
        cwd: options.installDir,
      },
      async (error, stdout, stderr) => {
        try {
          console.log(stdout);
          console.error(stderr);
          if (error) {
            options.status.error(
              `Preview.js could not install dependencies:\n${error}`
            );
            return reject(error);
          }
          await writeFile(
            installedVersionInfoPath(options),
            versionId(options),
            "utf8"
          );
          options.status.info("Preview.js is ready!");
          return resolve();
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

function installedVersionInfoPath(options: InstallOptions) {
  return path.join(options.installDir, ".install.info");
}

function versionId(options: InstallOptions) {
  return `${options.packageName}-${options.packageVersion}`;
}
