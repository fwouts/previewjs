import execa from "execa";
import fs from "fs";
import { readFile, realpath } from "fs/promises";
import inquirer from "inquirer";
import path from "path";
import { previewjsProVersion } from "../loader/src/version";
import { assertCleanGit } from "./clean-git";
import { gitChangelog } from "./git-changelog";
import { incrementVersion } from "./increment-version";
import { getPackageJson } from "./package-json";

async function main() {
  await assertCleanGit();

  console.log(
    `About to update loader bundle with @previewjs/pro v${previewjsProVersion}.`
  );
  const { version: coreVersion } = await import("../core/package.json");
  const { version: vfsVersion } = await import("../vfs/package.json");
  const { version: reactPluginVersion } = await import(
    "../frameworks/react/package.json"
  );
  const { version: solidPluginVersion } = await import(
    "../frameworks/solid/package.json"
  );
  const { version: vue2PluginVersion } = await import(
    "../frameworks/vue2/package.json"
  );
  const { version: vue3PluginVersion } = await import(
    "../frameworks/vue3/package.json"
  );
  const esbuildPackageJsonPath = await realpath(
    `${__dirname}/../core/node_modules/vite/../esbuild/package.json`
  );
  const esbuildPackageJson = await readFile(esbuildPackageJsonPath, "utf8");
  const { optionalDependencies: esbuildOptionalDependencies } =
    JSON.parse(esbuildPackageJson);
  const esbuildBinaryPackages = [
    "esbuild-darwin-64",
    "esbuild-darwin-arm64",
    "esbuild-linux-64",
    "esbuild-linux-arm64",
    "esbuild-windows-32",
    "esbuild-windows-64",
    "esbuild-windows-arm64",
  ];
  const esbuildBinaryDependencies: Record<string, string> = {};
  for (const binaryPackage of esbuildBinaryPackages) {
    const version = esbuildOptionalDependencies[binaryPackage];
    if (!version) {
      throw new Error(
        `Missing esbuild binary dependency: ${binaryPackage}. Perhaps the release script needs to be updated.`
      );
    }
    esbuildBinaryDependencies[binaryPackage] = version;
  }
  const releaseDirPath = path.join(__dirname, "..", "loader", "src", "release");
  await fs.promises.writeFile(
    path.join(releaseDirPath, "package.json"),
    JSON.stringify(
      {
        dependencies: {
          "@previewjs/core": coreVersion,
          "@previewjs/plugin-react": reactPluginVersion,
          "@previewjs/plugin-solid": solidPluginVersion,
          "@previewjs/plugin-vue2": vue2PluginVersion,
          "@previewjs/plugin-vue3": vue3PluginVersion,
          "@previewjs/pro": previewjsProVersion,
          "@previewjs/vfs": vfsVersion,
          ...esbuildBinaryDependencies,
        },
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Running npm install to fetch bundle and update lockfile...`);
  await execa("pnpm", ["npm", "install", "--ignore-scripts", "-f"], {
    cwd: releaseDirPath,
  });
  const prompt = inquirer.createPromptModule();
  const { releaseIntellij } = await prompt({
    name: "releaseIntellij",
    type: "confirm",
    message: "Release IntelliJ plugin?",
  });
  if (releaseIntellij) {
    await releaseIntellijPlugin();
  }
  const { releaseVscode } = await prompt({
    name: "releaseVscode",
    type: "confirm",
    message: "Release VS Code extension?",
  });
  if (releaseVscode) {
    await releaseVscodeExtension();
  }
  const { releaseCli } = await prompt({
    name: "releaseCli",
    type: "confirm",
    message: "Release CLI?",
  });
  if (releaseCli) {
    await releaseCliApp();
  }
}

async function releaseIntellijPlugin() {
  const intellijPath = path.join(__dirname, "..", "integrations", "intellij");
  const gradlePropertiesPath = `${intellijPath}/gradle.properties`;
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
  await release("integrations/intellij", version);
}

async function releaseVscodeExtension() {
  const vscodePath = path.join(__dirname, "..", "integrations", "vscode");
  const packageJson = getPackageJson(`${vscodePath}/package.json`);
  const { version: currentVersion } = await packageJson.read();
  const version = await incrementVersion(currentVersion);
  await packageJson.updateVersion(version);
  await fs.promises.writeFile(
    packageJson.absoluteFilePath,
    (
      await fs.promises.readFile(packageJson.absoluteFilePath, "utf8")
    ).replace(/-\d+\.\d+\.\d+\.vsix/g, `-${version}.vsix`),
    "utf8"
  );
  await release("integrations/vscode", version);
}

async function releaseCliApp() {
  const cliPath = path.join(__dirname, "..", "cli");
  const packageJson = getPackageJson(`${cliPath}/package.json`);
  const { version: currentVersion } = await packageJson.read();
  const version = await incrementVersion(currentVersion);
  await packageJson.updateVersion(version);
  await release("cli", version);
}

async function release(packageName: string, version: string) {
  const changelog = await gitChangelog(packageName, ["."]);
  const tag = `${packageName}/v${version}`;
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
