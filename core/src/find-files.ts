import fs from "fs-extra";
import globby from "globby";
import path from "path";

export async function findFiles(rootDirPath: string, pattern: string) {
  const gitRootPath = await findGitRoot(rootDirPath);
  const relativePath = path.relative(gitRootPath, rootDirPath);
  const relativePrefix = relativePath ? relativePath + path.sep : "";
  const files: string[] = await globby(relativePrefix + pattern, {
    gitignore: true,
    ignore: ["**/node_modules/**"],
    cwd: gitRootPath,
    absolute: true,
    followSymbolicLinks: false,
  });

  // Note: in some cases, presumably because of yarn using link
  // for faster node_modules, glob may return files in the parent
  // directory. We filter them out here.
  return files.filter((f) =>
    f.startsWith(rootDirPath.replace(/\\/g, "/") + "/")
  );
}

async function findGitRoot(
  dirPath: string,
  fallback = dirPath
): Promise<string> {
  try {
    if (await fs.exists(path.join(dirPath, ".git"))) {
      return dirPath;
    } else {
      const parentDirPath = path.dirname(dirPath);
      if (!parentDirPath || parentDirPath === dirPath) {
        return fallback;
      }
      return findGitRoot(parentDirPath, fallback);
    }
  } catch {
    return fallback;
  }
}
