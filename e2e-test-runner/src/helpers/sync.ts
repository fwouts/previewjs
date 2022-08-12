import {
  copyFile,
  lstat,
  mkdir,
  pathExists,
  readdir,
  remove,
  stat,
  symlink,
  unlink,
} from "fs-extra";
import path from "path";

export async function sync(srcPath: string, dstPath: string): Promise<void> {
  if (!(await pathExists(srcPath))) {
    throw new Error(`No such directory: ${srcPath}`);
  }
  if (!(await pathExists(dstPath))) {
    await mkdir(dstPath, { recursive: true });
  }

  // Keep track of existing files so we can remove the old ones later.
  const existingFiles = new Set(await readdir(dstPath));

  // Update all source files.
  const dirStat = (await pathExists(srcPath)) && (await stat(srcPath));
  if (!dirStat || !dirStat.isDirectory()) {
    throw new Error(`Expected a directory at ${srcPath}`);
  }

  for (const name of await readdir(srcPath)) {
    existingFiles.delete(name);
    const sourceFilePath = path.join(srcPath, name);
    const destinationFilePath = path.join(dstPath, name);
    const fileStat = await lstat(sourceFilePath);
    if (name === "node_modules") {
      if (await pathExists(destinationFilePath)) {
        await remove(destinationFilePath);
      }
      await mkdir(destinationFilePath);
      for (const f of await readdir(sourceFilePath)) {
        await symlink(
          path.join(sourceFilePath, f),
          path.join(destinationFilePath, f)
        );
      }
    } else if (fileStat.isSymbolicLink()) {
      // Ignore it.
    } else if (fileStat.isFile()) {
      if (await pathExists(destinationFilePath)) {
        const destinationFileStat = await stat(destinationFilePath);
        if (destinationFileStat.isDirectory()) {
          await remove(destinationFilePath);
        } else if (!destinationFileStat.isFile()) {
          await unlink(destinationFilePath);
        }
      }
      await copyFile(sourceFilePath, destinationFilePath);
    } else {
      await sync(sourceFilePath, destinationFilePath);
    }
  }

  // Remove any old files.
  for (const f of existingFiles) {
    const absoluteFilePath = path.join(dstPath, f);
    const fileStat = await stat(absoluteFilePath);
    if (fileStat.isDirectory()) {
      await remove(absoluteFilePath);
    } else {
      await unlink(absoluteFilePath);
    }
  }
}
