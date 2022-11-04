import execa from "execa";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import { inspect } from "util";
import { assertCleanGit } from "./clean-git";
import { gitChangelog } from "./git-changelog";
import { incrementVersion } from "./increment-version";
import { getPackageJson } from "./package-json";

type Package = {
  name: string;
  dirPath: string;
  additionalChangelogPath?: string[];
  ignoreDeps?: string[];
  tagName: string;
};

const packages: Package[] = [
  {
    name: "api",
    dirPath: "api",
    tagName: "api",
  },
  {
    name: "app",
    dirPath: "app",
    tagName: "app",
  },
  {
    name: "app-foundations",
    dirPath: "app-foundations",
    tagName: "app-foundations",
  },
  {
    name: "core",
    dirPath: "core",
    tagName: "core",
  },
  {
    name: "config",
    dirPath: "config",
    tagName: "config",
  },
  {
    name: "config-helper-nextjs",
    dirPath: "config-helpers/nextjs",
    tagName: "config-helpers/nextjs",
  },
  {
    name: "csf3",
    dirPath: "csf3",
    tagName: "csf3",
  },
  {
    name: "e2e-test-runner",
    dirPath: "e2e-test-runner",
    tagName: "e2e-test-runner",
  },
  {
    name: "iframe",
    dirPath: "iframe",
    tagName: "iframe",
  },
  {
    name: "plugin-react",
    dirPath: "frameworks/react",
    tagName: "plugins/react",
  },
  {
    name: "plugin-solid",
    dirPath: "frameworks/solid",
    tagName: "plugins/solid",
  },
  {
    name: "plugin-svelte",
    dirPath: "frameworks/svelte",
    tagName: "plugins/svelte",
  },
  {
    name: "plugin-vue2",
    dirPath: "frameworks/vue2",
    tagName: "plugins/vue2",
  },
  {
    name: "plugin-vue3",
    dirPath: "frameworks/vue3",
    tagName: "plugins/vue3",
  },
  {
    name: "properties",
    dirPath: "properties",
    tagName: "properties",
  },
  {
    name: "serializable-values",
    dirPath: "serializable-values",
    tagName: "serializable-values",
  },
  {
    name: "type-analyzer",
    dirPath: "type-analyzer",
    tagName: "type-analyzer",
  },
  {
    name: "vfs",
    dirPath: "vfs",
    tagName: "vfs",
  },
];

async function main() {
  await assertCleanGit();

  const localDependencies: Record<string, Set<string>> = {};
  for (const packageInfo of packages) {
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

  const releasedPackages: string[] = [];
  while (Object.entries(localDependencies).length > 0) {
    const nextPackageWithoutDeps = Object.entries(localDependencies).find(
      ([_, deps]) => deps.size === 0
    );
    if (!nextPackageWithoutDeps) {
      throw new Error(
        `Invalid state: no package left without updated dependencies.\n\nRemaining:\n${inspect(
          localDependencies
        )}`
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
    const released = await preparePackageRelease(packageInfo, dependents);
    if (released) {
      releasedPackages.push(released);
    }
    for (const deps of Object.values(localDependencies)) {
      deps.delete(scopedName);
    }
    delete localDependencies[scopedName];
  }

  if (releasedPackages.length > 0) {
    console.log(`Running pnpm install...`);
    await execa("pnpm", ["install"]);
    await execa("git", ["add", "."]);
    await execa("git", [
      "commit",
      "-m",
      `release: ${releasedPackages.join(", ")}`,
    ]);
    console.log(`Pushing commit...`);
    await execa("git", ["push", "origin", "main"]);
  }
}

async function preparePackageRelease(
  packageInfo: Package,
  dependents: string[]
): Promise<string | null> {
  const packageName = `@previewjs/${packageInfo.name}`;
  const packageJson = getPackageJson(`${packageInfo.dirPath}/package.json`);
  const { version: currentVersion } = await packageJson.read();
  console.log(
    `About to release: ${packageName} (current version: ${currentVersion})`
  );
  const changelog = await gitChangelog(packageName, [
    packageInfo.dirPath,
    ...(packageInfo.additionalChangelogPath || []),
  ]);
  if (!changelog) {
    console.log(`There is nothing to release.\n`);
    return null;
  }
  const prompt = inquirer.createPromptModule();
  console.log(`You are about to release the following:\n${changelog}`);
  const { shouldRelease } = await prompt({
    name: "shouldRelease",
    type: "confirm",
    message: `Would you like to release this?`,
  });
  if (!shouldRelease) {
    return null;
  }
  const version = await incrementVersion(currentVersion);
  await packageJson.updateVersion(version);
  for (const dependent of dependents) {
    const depPackageInfo = packages.find((p) => p.name === dependent);
    if (!depPackageInfo) {
      throw new Error(`Unable to find package info for: ${dependent}`);
    }
    await getPackageJson(
      `${depPackageInfo.dirPath}/package.json`
    ).updateDependency(packageName, version);
  }
  return `${packageName}@v${version}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
