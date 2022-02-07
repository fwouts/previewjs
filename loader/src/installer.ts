import execa from "execa";
import { mkdir, pathExists, readFile, writeFile } from "fs-extra";
import path from "path";

export async function isInstalled(options: {
  packageName: string;
  packageVersion: string;
  installDir: string;
}) {
  const versionCachePath = installedVersionInfoPath(options);
  return (
    (await pathExists(versionCachePath)) &&
    (await readFile(versionCachePath, "utf8")) === versionId(options)
  );
}

export async function install(options: {
  packageName: string;
  packageVersion: string;
  installDir: string;
  onOutput: (chunk: string) => void;
}) {
  options.onOutput(
    "Please wait while Preview.js installs dependencies. This could take a minute.\n\n"
  );
  const packageJsonPath = path.join(options.installDir, "package.json");
  await mkdir(options.installDir, { recursive: true });
  await writeFile(
    packageJsonPath,
    JSON.stringify({
      dependencies: {
        [options.packageName]: options.packageVersion,
      },
    })
  );
  options.onOutput(
    `Dependencies will be installed in: ${options.installDir}\n\n`
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
    const { failed } = await installProcess;
    if (failed) {
      throw new Error(`Preview.js could not install dependencies`);
    }
    options.onOutput(
      "\nPreview.js dependencies were installed successfully.\n\n"
    );
    await writeFile(
      installedVersionInfoPath(options),
      versionId(options),
      "utf8"
    );
  } catch (e) {
    options.onOutput(`\nOh no, it looks like installation failed!\n\n${e}`);
    throw e;
  }
}

function installedVersionInfoPath({ installDir }: { installDir: string }) {
  return path.join(installDir, ".install.info");
}

function versionId({
  packageName,
  packageVersion,
}: {
  packageName: string;
  packageVersion: string;
}) {
  return `${packageName}-${packageVersion}`;
}
