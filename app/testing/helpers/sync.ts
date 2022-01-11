import { symlinkSync } from "fs";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  pathExistsSync,
  readdirSync,
  removeSync,
  statSync,
  unlinkSync,
} from "fs-extra";
import path from "path";

export function sync(srcPath: string, dstPath: string): void {
  if (!existsSync(srcPath)) {
    return;
  }
  if (!existsSync(dstPath)) {
    mkdirSync(dstPath, { recursive: true });
  }

  // Keep track of existing files so we can remove the old ones later.
  const existingFiles = new Set(readdirSync(dstPath));

  // Update all source files.
  const dirStat = existsSync(srcPath) && statSync(srcPath);
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
        removeSync(destinationFilePath);
      }
      mkdirSync(destinationFilePath);
      for (const f of readdirSync(sourceFilePath)) {
        symlinkSync(
          path.join(sourceFilePath, f),
          path.join(destinationFilePath, f)
        );
      }
    } else if (fileStat.isSymbolicLink()) {
      // Ignore it.
    } else if (fileStat.isFile()) {
      if (existsSync(destinationFilePath)) {
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
    const filePath = path.join(dstPath, f);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      removeSync(filePath);
    } else {
      unlinkSync(filePath);
    }
  }
}
