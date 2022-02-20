import execa from "execa";
import { mkdir, pathExists, readFile, writeFile } from "fs-extra";
import os from "os";
import path from "path";

// Source: https://github.com/evanw/esbuild/blob/bf341f7104b373d85061c31ebb00efc6f9a8bf5a/lib/npm/node-platform.ts
const esbuildPackages: Record<string, string> = {
  "win32 arm64 LE": "esbuild-windows-arm64",
  "win32 ia32 LE": "esbuild-windows-32",
  "win32 x64 LE": "esbuild-windows-64",
  "android arm64 LE": "esbuild-android-arm64",
  "darwin arm64 LE": "esbuild-darwin-arm64",
  "darwin x64 LE": "esbuild-darwin-64",
  "freebsd arm64 LE": "esbuild-freebsd-arm64",
  "freebsd x64 LE": "esbuild-freebsd-64",
  "linux arm LE": "esbuild-linux-arm",
  "linux arm64 LE": "esbuild-linux-arm64",
  "linux ia32 LE": "esbuild-linux-32",
  "linux mips64el LE": "esbuild-linux-mips64le",
  "linux ppc64 LE": "esbuild-linux-ppc64le",
  "linux riscv64 LE": "esbuild-linux-riscv64",
  "linux s390x BE": "esbuild-linux-s390x",
  "linux x64 LE": "esbuild-linux-64",
  "netbsd x64 LE": "esbuild-netbsd-64",
  "openbsd x64 LE": "esbuild-openbsd-64",
  "sunos x64 LE": "esbuild-sunos-64",
};

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
  // Explicitly install the binary version needed by esbuild in case NPM uses a different
  // architecture or decides to skip it for any reason.
  // See https://github.com/fwouts/previewjs/issues/236.
  const esbuildPlatformKey = `${
    process.platform
  } ${os.arch()} ${os.endianness()}`;
  const esbuildPlatformPackage = esbuildPackages[esbuildPlatformKey];
  await writeFile(
    packageJsonPath,
    JSON.stringify({
      dependencies: {
        [options.packageName]: options.packageVersion,
        ...(esbuildPlatformPackage
          ? {
              [esbuildPlatformPackage]: "*",
            }
          : {}),
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
