import fs from "fs-extra";
import os from "os";
import path from "path";

export function duplicateProjectForTesting(testProjectDirPath: string) {
  const tmpDir = fs.realpathSync(os.tmpdir());
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
  fs.mkdirpSync(rootDirPath);
  sync(testProjectDirPath, rootDirPath);
  return rootDirPath;
}

function sync(srcPath: string, dstPath: string): void {
  if (!fs.pathExistsSync(srcPath)) {
    throw new Error(`No such directory: ${srcPath}`);
  }
  if (!fs.pathExistsSync(dstPath)) {
    fs.mkdirSync(dstPath, { recursive: true });
  }

  // Keep track of existing files so we can remove the old ones later.
  const existingFiles = new Set(fs.readdirSync(dstPath));

  // Update all source files.
  const dirStat = fs.pathExistsSync(srcPath) && fs.statSync(srcPath);
  if (!dirStat || !dirStat.isDirectory()) {
    throw new Error(`Expected a directory at ${srcPath}`);
  }

  for (const name of fs.readdirSync(srcPath)) {
    existingFiles.delete(name);
    const sourceFilePath = path.join(srcPath, name);
    const destinationFilePath = path.join(dstPath, name);
    const fileStat = fs.lstatSync(sourceFilePath);
    if (name === "node_modules") {
      if (fs.pathExistsSync(destinationFilePath)) {
        continue;
      }
      fs.mkdirSync(destinationFilePath);
      for (const f of fs.readdirSync(sourceFilePath)) {
        if (f === ".previewjs") {
          // Ignore.
          continue;
        }
        fs.symlinkSync(
          path.join(sourceFilePath, f),
          path.join(destinationFilePath, f)
        );
      }
    } else if (fileStat.isSymbolicLink()) {
      // Ignore it.
    } else if (fileStat.isFile()) {
      if (fs.pathExistsSync(destinationFilePath)) {
        const destinationFileStat = fs.statSync(destinationFilePath);
        if (destinationFileStat.isDirectory()) {
          fs.removeSync(destinationFilePath);
        } else if (!destinationFileStat.isFile()) {
          fs.unlinkSync(destinationFilePath);
        }
      }
      fs.copyFileSync(sourceFilePath, destinationFilePath);
    } else {
      sync(sourceFilePath, destinationFilePath);
    }
  }

  // Remove any old files.
  for (const f of existingFiles) {
    const absoluteFilePath = path.join(dstPath, f);
    const fileStat = fs.statSync(absoluteFilePath);
    if (fileStat.isDirectory()) {
      fs.removeSync(absoluteFilePath);
    } else {
      fs.unlinkSync(absoluteFilePath);
    }
  }
}
