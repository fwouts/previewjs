import fs from "fs-extra";
import path from "path";

export type PackageDependencies = Record<
  string,
  {
    majorVersion: number;
  }
>;

export async function extractPackageDependencies(
  rootDirPath: string
): Promise<PackageDependencies> {
  const packageJsonPath = path.join(rootDirPath, "package.json");
  if (!(await fs.pathExists(packageJsonPath))) {
    return {};
  }
  let { dependencies, devDependencies } = JSON.parse(
    await fs.readFile(packageJsonPath, "utf8")
  );
  const allDependencies = {
    ...dependencies,
    ...devDependencies,
  };
  return Object.fromEntries<{ majorVersion: number }>(
    Object.entries(allDependencies).map(([name, version]) => {
      let majorVersion: number;
      if (typeof version !== "string") {
        majorVersion = 0;
      } else if (version.startsWith("^") || version.startsWith("~")) {
        majorVersion = parseInt(version.slice(1));
      } else {
        majorVersion = parseInt(version);
      }
      return [name, { majorVersion }];
    })
  );
}
