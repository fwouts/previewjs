import assertNever from "assert-never";
import axios from "axios";
import execa from "execa";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";

type Package = {
  name: string;
  dirPath: string;
  additionalDirPath?: string[];
  ignoreDeps?: string[];
  tagName: string;
  type: "npm" | "loader" | "intellij" | "vscode";
};

const packages: Package[] = [
  {
    name: "api",
    dirPath: "api",
    tagName: "api",
    type: "npm",
  },
  {
    name: "app",
    dirPath: "app",
    tagName: "app",
    type: "npm",
    ignoreDeps: ["loader"],
  },
  {
    name: "core",
    dirPath: "core",
    tagName: "core",
    type: "npm",
  },
  {
    name: "config",
    dirPath: "config",
    tagName: "config",
    type: "npm",
  },
  {
    name: "plugin-react",
    dirPath: "frameworks/react",
    tagName: "plugins/react",
    type: "npm",
  },
  {
    name: "plugin-vue2",
    dirPath: "frameworks/vue2",
    tagName: "plugins/vue2",
    type: "npm",
  },
  {
    name: "plugin-vue3",
    dirPath: "frameworks/vue3",
    tagName: "plugins/vue3",
    type: "npm",
  },
  {
    name: "type-analyzer",
    dirPath: "type-analyzer",
    tagName: "type-analyzer",
    type: "npm",
  },
  {
    name: "vfs",
    dirPath: "vfs",
    tagName: "vfs",
    type: "npm",
  },
  {
    name: "loader",
    dirPath: "loader",
    tagName: "loader",
    type: "loader",
  },
  {
    name: "integration-intellij",
    dirPath: "integrations/intellij",
    tagName: "integrations/intellij",
    type: "intellij",
  },
  {
    name: "integration-vscode",
    dirPath: "integrations/vscode",
    tagName: "integrations/vscode",
    type: "vscode",
  },
];

async function main() {
  const { stdout: gitBranch } = await execa("git", [
    "rev-parse",
    "--abbrev-ref",
    "HEAD",
  ]);
  if (gitBranch !== "main") {
    throw new Error(`You are trying to release the wrong branch: ${gitBranch}`);
  }
  const { stdout: gitPorcelain } = await execa("git", [
    "status",
    "--porcelain",
  ]);
  if (gitPorcelain) {
    throw new Error(`Git status is not clean:\n${gitPorcelain}`);
  }

  const localDependencies: Record<string, Set<string>> = {
    loader: new Set(["app"]),
    "integration-intellij": new Set(["loader"]),
    "integration-vscode": new Set(["loader"]),
  };
  for (const packageInfo of packages) {
    if (packageInfo.type === "npm") {
      const deps = new Set<string>();
      const packageJson = JSON.parse(
        await fs.promises.readFile(
          path.join(packageInfo.dirPath, "package.json"),
          "utf8"
        )
      );
      for (const packageName of Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      })) {
        const [org, scopedName] = packageName.split("/");
        if (org !== "@previewjs") {
          continue;
        }
        if (!scopedName) {
          throw new Error(`Expected a scoped package, found ${packageName}`);
        }
        if (!packageInfo.ignoreDeps?.includes(scopedName)) {
          deps.add(scopedName);
        }
      }
      localDependencies[packageInfo.name] = deps;
    }
  }

  while (Object.entries(localDependencies).length > 0) {
    const nextPackageWithoutDeps = Object.entries(localDependencies).find(
      ([_, deps]) => deps.size === 0
    );
    if (!nextPackageWithoutDeps) {
      throw new Error(
        `Invalid state: no package left without updated dependencies.`
      );
    }
    const scopedName = nextPackageWithoutDeps[0];
    const packageInfo = packages.find((p) => p.name === scopedName);
    if (!packageInfo) {
      throw new Error(`Missing package info for name: ${scopedName}`);
    }
    const dependents = Object.entries(localDependencies)
      .filter(([_, deps]) => deps.has(scopedName))
      .map(([name]) => name);
    await releasePackage(packageInfo, dependents);
    for (const deps of Object.values(localDependencies)) {
      deps.delete(scopedName);
    }
    delete localDependencies[scopedName];
  }
}

async function releasePackage(packageInfo: Package, dependents: string[]) {
  const packageName = `@previewjs/${packageInfo.name}`;
  console.log(`About to release: ${packageName}`);
  const changelog = await gitChangelog(packageName, [packageInfo.dirPath]);
  if (!changelog) {
    console.log(`There is nothing to release.\n`);
    return;
  }
  console.log(`You are about to release the following:\n${changelog}`);
  let version: string;
  switch (packageInfo.type) {
    case "npm":
      version = await updateNodePackage(packageInfo.dirPath);
      break;
    case "loader":
      version = await updateNodePackage(packageInfo.dirPath);
      const { version: appVersion } = await import("../app/package.json");
      const releaseDirPath = path.join(packageInfo.dirPath, "src", "release");
      await fs.promises.writeFile(
        path.join(releaseDirPath, "package.json"),
        JSON.stringify(
          {
            dependencies: {
              "@previewjs/app": appVersion,
            },
          },
          null,
          2
        ),
        "utf8"
      );
      await execa("npm", ["install"], {
        cwd: releaseDirPath,
      });
      break;
    case "intellij":
      version = await updateIntellijVersion(packageInfo.dirPath);
      break;
    case "vscode":
      version = await updateNodePackage(packageInfo.dirPath);
      const packageJsonPath = path.join(packageInfo.dirPath, "package.json");
      await fs.promises.writeFile(
        packageJsonPath,
        (
          await fs.promises.readFile(packageJsonPath, "utf8")
        ).replace(/-\d+\.\d+\.\d+\.vsix/g, `-${version}.vsix`),
        "utf8"
      );
      break;
    default:
      throw assertNever(packageInfo.type);
  }
  for (const dependent of dependents) {
    const depPackageInfo = packages.find((p) => p.name === dependent);
    if (!depPackageInfo) {
      throw new Error(`Unable to find package info for: ${dependent}`);
    }
    switch (depPackageInfo.type) {
      case "npm":
        await packageJson(
          `${depPackageInfo.dirPath}/package.json`
        ).updateDependency(packageName, version);
        break;
      case "loader":
        await packageJson(
          `${depPackageInfo.dirPath}/package.json`
        ).updateDependency(packageName, version);
        break;
      case "intellij":
      case "vscode":
        // Nothing to do, the app package version is set in loader/src/release.
        break;
      default:
        throw assertNever(depPackageInfo.type);
    }
  }
  const tag = `${packageInfo.tagName}/v${version}`;
  console.log(`The following tag will be created: ${tag}\n`);
  console.log(`Running pnpm install...`);
  await execa("pnpm", ["install"]);
  await execa("git", ["add", "."]);
  await execa("git", ["commit", "-m", `release: ${packageName}@${version}`]);
  await execa("git", ["tag", "-a", tag, "-m", ""]);
  console.log(`Pushing commit...`);
  await execa("git", ["push", "origin", "main"]);
  await execa("git", ["push", "origin", tag]);
  console.log(`Creating release...`);
  await execa("gh", ["release", "create", tag, "-t", tag, "-n", changelog]);
  console.log(`Done!`);

  if (packageInfo.type === "npm") {
    console.log("Waiting for NPM package to be published...");
    while (true) {
      try {
        await axios.get(`https://registry.npmjs.org/${packageName}/${version}`);
        console.log("Success!");
        break;
      } catch (e) {
        console.log("Waiting...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
  console.log("");
}

async function gitChangelog(packageName: string, dirPaths: string[]) {
  const { stdout } = await execa("git", [
    "log",
    "--oneline",
    "--",
    ...dirPaths,
  ]);
  let commitMessages = stdout.split("\n");
  const lastReleaseIndex = commitMessages.findIndex((message) =>
    message.match(
      `^\\w+ release: ${packageName.replace(/\//g, "\\/")}@\\d+\\.\\d+\\.\\d+$`
    )
  );
  if (lastReleaseIndex !== -1) {
    commitMessages = commitMessages.slice(0, lastReleaseIndex);
  }
  return `${commitMessages.map((message) => `- ${message}`).join("\n")}`;
}

async function updateNodePackage(dirPath: string) {
  const packageModifier = packageJson(`${dirPath}/package.json`);
  const { version: oldVersion } = await packageModifier.read();
  const version = await incrementVersion(oldVersion);
  await packageModifier.updateVersion(version);
  return version;
}

async function updateIntellijVersion(dirPath: string) {
  // Note: this isn't actually a Node package.
  const gradlePropertiesPath = `${dirPath}/gradle.properties`;
  const gradlePropertiesContent = await fs.promises.readFile(
    gradlePropertiesPath,
    "utf8"
  );
  const oldVersion = gradlePropertiesContent
    .split("\n")
    .find((line) => line.startsWith("pluginVersion = "))
    ?.split(" = ")[1];
  if (!oldVersion) {
    throw new Error(`Unable to find version in ${gradlePropertiesPath}`);
  }
  const version = await incrementVersion(oldVersion);
  await fs.promises.writeFile(
    gradlePropertiesPath,
    gradlePropertiesContent
      .split("\n")
      .map((line) =>
        line.startsWith("pluginVersion = ")
          ? `pluginVersion = ${version}`
          : line
      )
      .join("\n"),
    "utf8"
  );
  return version;
}

async function incrementVersion(oldVersion: string) {
  let [major, minor, patch] = oldVersion
    .split(".")
    .map((str: string) => parseInt(str));
  major ||= 0;
  minor ||= 0;
  patch ||= 0;
  const prompt = inquirer.createPromptModule();
  const { releaseType } = await prompt({
    name: "releaseType",
    type: "list",
    message: "Pick a release type",
    choices: ["patch", "minor", "major"],
  });
  switch (releaseType) {
    case "patch":
      patch += 1;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
  }
  const version = `${major}.${minor}.${patch}`;
  return version;
}

function packageJson(absoluteFilePath: string) {
  return new PackageJsonModifier(absoluteFilePath);
}

class PackageJsonModifier {
  constructor(private readonly absoluteFilePath: string) {}

  async read() {
    return JSON.parse(
      await fs.promises.readFile(this.absoluteFilePath, "utf8")
    );
  }

  async updateVersion(version: string) {
    const { name, version: _oldVersion, ...packageInfo } = await this.read();
    await this.write({
      name,
      version,
      ...packageInfo,
    });
  }

  async updateDependency(name: string, version: string) {
    const { dependencies, devDependencies, ...packageInfo } = await this.read();
    await this.write({
      ...packageInfo,
      dependencies: Object.fromEntries(
        Object.entries(dependencies).map(([depName, depVersion]) => [
          depName,
          depName === name ? version : depVersion,
        ])
      ),
      devDependencies,
    });
  }

  private async write(info: any) {
    await fs.promises.writeFile(
      this.absoluteFilePath,
      JSON.stringify(info, null, 2) + "\n",
      "utf8"
    );
  }
}

async function replaceInFile(
  absoluteFilePath: string,
  search: RegExp,
  replacement: string
) {
  const originalContent = await fs.promises.readFile(absoluteFilePath, "utf8");
  const updatedContent = originalContent.replace(search, replacement);
  if (originalContent === updatedContent) {
    throw new Error(`No change in ${absoluteFilePath}`);
  }
  await fs.promises.writeFile(absoluteFilePath, updatedContent, "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
