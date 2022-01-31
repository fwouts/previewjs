import execa from "execa";
import fs from "fs";
import inquirer from "inquirer";

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
  const packageName = process.argv[2];
  if (!packageName) {
    throw new Error(`Please specify a package to release`);
  }
  let tagName: string;
  let dirPath: string;
  let version: string;
  switch (packageName) {
    case "@previewjs/app": {
      tagName = "app";
      dirPath = "app";
      version = await updateNodePackage(packageName, dirPath);
      await replaceInFile(
        "integrations/intellij/src/main/kotlin/com/previewjs/intellij/plugin/services/PreviewJsService.kt",
        /\["PREVIEWJS_PACKAGE_VERSION"\] = "\d+\.\d+\.\d+"/,
        `["PREVIEWJS_PACKAGE_VERSION"] = "${version}"`
      );
      await replaceInFile(
        "integrations/vscode/webpack.config.js",
        /PREVIEWJS_PACKAGE_VERSION": JSON.stringify\("\d+\.\d+\.\d+"\)/,
        `PREVIEWJS_PACKAGE_VERSION": JSON.stringify("${version}")`
      );
      break;
    }
    case "@previewjs/config": {
      tagName = "config";
      dirPath = "config";
      version = await updateNodePackage(packageName, dirPath);
      await packageJson("app/package.json").updateDependency(
        packageName,
        version
      );
      await packageJson("core/package.json").updateDependency(
        packageName,
        version
      );
      break;
    }
    case "@previewjs/core": {
      tagName = "core";
      dirPath = "core";
      version = await updateNodePackage(packageName, dirPath);
      await packageJson("app/package.json").updateDependency(
        packageName,
        version
      );
      break;
    }
    case "@previewjs/plugin-react":
    case "@previewjs/plugin-vue2":
    case "@previewjs/plugin-vue3": {
      const frameworkName = packageName.substring("@previewjs/plugin-".length);
      tagName = `plugins/${frameworkName}`;
      dirPath = `frameworks/${frameworkName}`;
      version = await updateNodePackage(packageName, dirPath);
      await packageJson("app/package.json").updateDependency(
        packageName,
        version
      );
      break;
    }
    case "@previewjs/integration-intellij": {
      tagName = "integrations/intellij";
      dirPath = "integrations/intellij";
      version = await updateIntellijVersion(packageName, dirPath);
      break;
    }
    case "@previewjs/integration-vscode": {
      tagName = "integrations/vscode";
      dirPath = "integrations/vscode";
      // Note: the VS Code extension has the special package name "previewjs".
      version = await updateNodePackage("previewjs", "integrations/vscode");
      break;
    }
    default:
      throw new Error(`Unknown package name: ${packageName}`);
  }
  const tag = `${tagName}/v${version}`;
  const changelog = await gitChangelog(packageName, dirPath);
  await execa("pnpm", ["install"]);
  await execa("git", ["add", "."]);
  await execa("git", ["commit", "-m", `release: ${packageName}@${version}`]);
  await execa("git", ["tag", "-a", tag, "-m", ""]);
  await execa("git", ["push", "origin", "main"]);
  await execa("git", ["push", "origin", tag]);
  await execa("gh", ["release", "create", tag, "-t", tag, "-n", changelog]);
}

async function gitChangelog(packageName: string, dirPath: string) {
  const { stdout } = await execa("git", ["log", "--oneline", "--", dirPath]);
  let commitMessages = stdout.split("\n");
  const lastReleaseIndex = commitMessages.findIndex((message) =>
    message.match(
      `^\\w+ release: ${packageName.replace(/\//g, "\\/")}@\\d+\\.\\d+\\.\\d+$`
    )
  );
  if (lastReleaseIndex !== -1) {
    commitMessages = commitMessages.slice(0, lastReleaseIndex);
  }
  if (commitMessages.length === 0) {
    throw new Error(`There is nothing to release.`);
  }
  return `${commitMessages.map((message) => `- ${message}`).join("\n")}`;
}

async function updateNodePackage(packageName: string, dirPath: string) {
  console.log(
    `You are about to release the following:\n${await gitChangelog(
      packageName,
      dirPath
    )}`
  );
  const packageModifier = packageJson(`${dirPath}/package.json`);
  const { version: oldVersion } = await packageModifier.read();
  const version = await incrementVersion(oldVersion);
  await packageModifier.updateVersion(version);
  return version;
}

async function updateIntellijVersion(packageName: string, dirPath: string) {
  console.log(
    `You are about to release the following:\n${await gitChangelog(
      packageName,
      dirPath
    )}`
  );
  // Note: this isn't actually a Node package.
  const gradlePropertiesPath = "integrations/intellij/gradle.properties";
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

function packageJson(filePath: string) {
  return new PackageJsonModifier(filePath);
}

class PackageJsonModifier {
  constructor(private readonly filePath: string) {}

  async read() {
    return JSON.parse(await fs.promises.readFile(this.filePath, "utf8"));
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
      this.filePath,
      JSON.stringify(info, null, 2) + "\n",
      "utf8"
    );
  }
}

async function replaceInFile(
  filePath: string,
  search: RegExp,
  replacement: string
) {
  const originalContent = await fs.promises.readFile(filePath, "utf8");
  const updatedContent = originalContent.replace(search, replacement);
  if (originalContent === updatedContent) {
    throw new Error(`No change in ${filePath}`);
  }
  await fs.promises.writeFile(filePath, updatedContent, "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
