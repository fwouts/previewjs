import { realpathSync } from "fs";
import {
  copyFileSync,
  lstatSync,
  mkdirpSync,
  mkdirSync,
  pathExistsSync,
  readdirSync,
  removeSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from "fs-extra";
import os from "os";
import path from "path";

export function duplicateProjectForTesting(testProjectDirPath: string) {
  const tmpDir = realpathSync(os.tmpdir());
  let rootDirPath = path.join(
    tmpDir,
    `${path.basename(testProjectDirPath)}-${process.pid}`
  );
  // TODO: Remove this hack because Windows tests fail in CI
  // presumably because of different drives.
  if (rootDirPath.startsWith("C:\\Users\\RUNNER~")) {
    rootDirPath = rootDirPath.replace(
      /C:\\Users\\RUNNER~\d+/g,
      "D:\\a\\previewjs"
    );
  }
  mkdirpSync(rootDirPath);
  sync(testProjectDirPath, rootDirPath);
  return rootDirPath;
}

function sync(srcPath: string, dstPath: string): void {
  if (!pathExistsSync(srcPath)) {
    throw new Error(`No such directory: ${srcPath}`);
  }
  if (!pathExistsSync(dstPath)) {
    mkdirSync(dstPath, { recursive: true });
  }

  // Keep track of existing files so we can remove the old ones later.
  const existingFiles = new Set(readdirSync(dstPath));

  // Update all source files.
  const dirStat = pathExistsSync(srcPath) && statSync(srcPath);
  if (!dirStat || !dirStat.isDirectory()) {
    throw new Error(`Expected a directory at ${srcPath}`);
  }

  for (const name of readdirSync(srcPath)) {
    existingFiles.delete(name);
    const sourceFilePath = path.join(srcPath, name);
    const destinationFilePath = path.join(dstPath, name);
    const fileStat = lstatSync(sourceFilePath);
    if (name === "node_modules") {
      if (pathExistsSync(destinationFilePath)) {
        continue;
      }
      mkdirSync(destinationFilePath);
      for (const f of readdirSync(sourceFilePath)) {
        if (f === ".previewjs") {
          // Ignore.
          continue;
        }
        symlinkSync(
          path.join(sourceFilePath, f),
          path.join(destinationFilePath, f)
        );
      }
    } else if (fileStat.isSymbolicLink()) {
      // Ignore it.
    } else if (fileStat.isFile()) {
      if (pathExistsSync(destinationFilePath)) {
        const destinationFileStat = statSync(destinationFilePath);
        if (destinationFileStat.isDirectory()) {
          removeSync(destinationFilePath);
        } else if (!destinationFileStat.isFile()) {
          unlinkSync(destinationFilePath);
        }
      }
      copyFileSync(sourceFilePath, destinationFilePath);
    } else {
      sync(sourceFilePath, destinationFilePath);
    }
  }

  // Remove any old files.
  for (const f of existingFiles) {
    const absoluteFilePath = path.join(dstPath, f);
    const fileStat = statSync(absoluteFilePath);
    if (fileStat.isDirectory()) {
      removeSync(absoluteFilePath);
    } else {
      unlinkSync(absoluteFilePath);
    }
  }
}
