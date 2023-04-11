import fs from "fs-extra";
import { globby } from "globby";
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
    suppressErrors: true,
  });

  // Note: in some cases, presumably because of yarn using link
  // for faster node_modules, glob may return files in the parent
  // directory. We filter them out here.
  let normalizedRootDirPath = rootDirPath.replace(/\\/g, "/");
  if (!normalizedRootDirPath.endsWith("/")) {
    normalizedRootDirPath += "/";
  }
  return files.filter((f) => f.startsWith(normalizedRootDirPath));
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
