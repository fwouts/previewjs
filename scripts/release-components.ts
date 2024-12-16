/* eslint-disable no-console */
import { execa } from "execa";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import { inspect } from "util";
import { assertCleanGit } from "./clean-git.js";
import { gitChangelog } from "./git-changelog.js";
import { incrementVersion } from "./increment-version.js";
import { getPackageJson } from "./package-json.js";

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
    name: "chromeless",
    dirPath: "chromeless",
    tagName: "chromeless",
  },
  {
    name: "core",
    dirPath: "core",
    tagName: "core",
  },
  {
    name: "analyzer-api",
    dirPath: "analyzer/api",
    tagName: "analyzer/api",
  },
  {
    name: "analyzer-react",
    dirPath: "analyzer/react",
    tagName: "analyzer/react",
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
    name: "iframe",
    dirPath: "iframe",
    tagName: "iframe",
  },
  {
    name: "plugin-preact",
    dirPath: "framework-plugins/preact",
    tagName: "plugins/preact",
  },
  {
    name: "plugin-react",
    dirPath: "framework-plugins/react",
    tagName: "plugins/react",
  },
  {
    name: "plugin-solid",
    dirPath: "framework-plugins/solid",
    tagName: "plugins/solid",
  },
  {
    name: "plugin-svelte",
    dirPath: "framework-plugins/svelte",
    tagName: "plugins/svelte",
  },
  {
    name: "plugin-vue2",
    dirPath: "framework-plugins/vue2",
    tagName: "plugins/vue2",
  },
  {
    name: "plugin-vue3",
    dirPath: "framework-plugins/vue3",
    tagName: "plugins/vue3",
  },
  {
    name: "properties",
    dirPath: "properties",
    tagName: "properties",
  },
  {
    name: "screenshot",
    dirPath: "screenshot",
    tagName: "screenshot",
  },
  {
    name: "serializable-values",
    dirPath: "serializable-values",
    tagName: "serializable-values",
  },
  {
    name: "storybook-helpers",
    dirPath: "storybook-helpers",
    tagName: "storybook-helpers",
  },
  {
    name: "testing",
    dirPath: "testing",
    tagName: "testing",
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
  const forceReleasePackages: Record<string, Set<string>> = {};
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
    const released = await preparePackageRelease(
      packageInfo,
      dependents,
      forceReleasePackages[scopedName]
    );
    if (released) {
      releasedPackages.push(released.versionedPackageName);
      for (const packageName of released.impactedPackageNames) {
        forceReleasePackages[packageName] ||= new Set();
        forceReleasePackages[packageName]?.add(released.versionedPackageName);
      }
    }
    for (const deps of Object.values(localDependencies)) {
      deps.delete(scopedName);
    }
    delete localDependencies[scopedName];
  }

  if (releasedPackages.length > 0) {
    console.log(`Running pnpm install...`);
    await execa("pnpm", ["install"], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
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
  dependents: string[],
  majorDependencyUpdates: Set<string> | null = null
) {
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
  if (!changelog && !majorDependencyUpdates) {
    console.log(`There is nothing to release.\n`);
    return null;
  }
  const prompt = inquirer.createPromptModule();
  console.log(`You are about to release the following:`);
  if (majorDependencyUpdates) {
    for (const dependency of majorDependencyUpdates) {
      console.log(`- major dependency update: ${dependency}`);
    }
  }
  console.log(changelog);
  const { shouldRelease } = await prompt({
    name: "shouldRelease",
    type: "confirm",
    message: `Would you like to release this?`,
  });
  if (!shouldRelease) {
    return null;
  }
  const version = await incrementVersion(currentVersion);
  const isMajorUpdate = version.endsWith(".0.0");
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
  return {
    versionedPackageName: `${packageName}@v${version}`,
    impactedPackageNames: isMajorUpdate ? dependents : [],
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
