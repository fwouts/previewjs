/* eslint-disable no-console */
import { execa } from "execa";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import url from "url";
import { previewjsProVersion } from "../loader/src/version.js";
import { assertCleanGit, isGitClean } from "./clean-git.js";
import { gitChangelog } from "./git-changelog.js";
import { incrementVersion } from "./increment-version.js";
import { getPackageJson } from "./package-json.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

async function main() {
  await assertCleanGit();

  const prompt = inquirer.createPromptModule();
  const { updateLoaderPackageLock } = await prompt({
    name: "updateLoaderPackageLock",
    type: "confirm",
    message: "Update loader dependencies?",
  });
  if (updateLoaderPackageLock) {
    console.log(
      `About to update loader bundle with @previewjs/pro v${previewjsProVersion}.`
    );
    const {
      default: { version: coreVersion },
    } = await import("../core/package.json", {
      with: { type: "json" },
    });
    const {
      default: { version: vfsVersion },
    } = await import("../vfs/package.json", {
      with: { type: "json" },
    });
    const {
      default: { version: preactPluginVersion },
    } = await import("../framework-plugins/preact/package.json", {
      with: { type: "json" },
    });
    const {
      default: { version: reactPluginVersion },
    } = await import("../framework-plugins/react/package.json", {
      with: { type: "json" },
    });
    const {
      default: { version: solidPluginVersion },
    } = await import("../framework-plugins/solid/package.json", {
      with: { type: "json" },
    });
    const {
      default: { version: sveltePluginVersion },
    } = await import("../framework-plugins/svelte/package.json", {
      with: { type: "json" },
    });
    const {
      default: { version: vue2PluginVersion },
    } = await import("../framework-plugins/vue2/package.json", {
      with: { type: "json" },
    });
    const {
      default: { version: vue3PluginVersion },
    } = await import("../framework-plugins/vue3/package.json", {
      with: { type: "json" },
    });
    const releaseDirPath = path.join(
      __dirname,
      "..",
      "loader",
      "src",
      "release"
    );
    await fs.promises.writeFile(
      path.join(releaseDirPath, "package.json"),
      JSON.stringify(
        {
          name: "@previewjs/loader-release",
          dependencies: {
            "@previewjs/core": coreVersion,
            "@previewjs/plugin-preact": preactPluginVersion,
            "@previewjs/plugin-react": reactPluginVersion,
            "@previewjs/plugin-solid": solidPluginVersion,
            "@previewjs/plugin-svelte": sveltePluginVersion,
            "@previewjs/plugin-vue2": vue2PluginVersion,
            "@previewjs/plugin-vue3": vue3PluginVersion,
            "@previewjs/pro": previewjsProVersion,
            "@previewjs/vfs": vfsVersion,
          },
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(`Running pnpm install...`);
    await fs.promises.unlink(path.join(releaseDirPath, "pnpm-lock.yaml"));
    await execa("pnpm", ["install", "--lockfile-only"], {
      cwd: releaseDirPath,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    await execa("git", ["add", "."]);
    if (!(await isGitClean())) {
      await execa("git", [
        "commit",
        "-m",
        `release: update loader dependencies`,
      ]);
      await execa("git", ["push", "origin", "main"]);
    }
  }
  const { releaseCli } = await prompt({
    name: "releaseCli",
    type: "confirm",
    message: "Release CLI?",
  });
  if (releaseCli) {
    await releaseCliApp();
  }
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
  const cliPath = path.join(__dirname, "..", "integrations", "cli");
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
