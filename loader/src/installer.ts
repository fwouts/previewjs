import execa from "execa";
import { mkdir, pathExists, readFile, writeFile } from "fs-extra";
import path from "path";
import packageLockJson from "./release/package-lock.json";
import packageJson from "./release/package.json";

export async function isInstalled(options: { installDir: string }) {
  const installedPackageJsonPath = installedPackageJson(options);
  return (
    (await pathExists(installedPackageJsonPath)) &&
    (await readFile(installedPackageJsonPath, "utf8")) ===
      JSON.stringify(packageJson)
  );
}

export async function install(options: {
  installDir: string;
  onOutput: (chunk: string) => void;
}) {
  options.onOutput(
    "Please wait while Preview.js installs dependencies. This could take a minute.\n\n"
  );
  await mkdir(options.installDir, { recursive: true });
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
    const { failed, isCanceled } = await installProcess;
    if (failed || isCanceled) {
      throw new Error(`Preview.js could not install dependencies`);
    }
    options.onOutput(
      "\nPreview.js dependencies were installed successfully.\n\n"
    );
    await writeFile(installedPackageJson(options), JSON.stringify(packageJson));
  } catch (e) {
    options.onOutput(`\nOh no, it looks like installation failed!\n\n${e}`);
    throw e;
  }
}

function installedPackageJson({ installDir }: { installDir: string }) {
  return path.join(installDir, "package.installed.json");
}
