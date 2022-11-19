import fs from "fs-extra";
import path from "path";
import { sync } from "./sync";

export async function prepareTestDir(testDir: string) {
  // Ensure we don't have a cache directory.
  const cacheDirPath = path.join(testDir, "node_modules", ".previewjs");
  if (await fs.pathExists(cacheDirPath)) {
    await fs.remove(cacheDirPath);
  }
  const tempParentDirPath = path.join(testDir, "..", "_tmp_");
  await fs.mkdirp(tempParentDirPath);
  const rootDirPath = await fs.mkdtemp(path.join(tempParentDirPath, "app-"));
  await fs.mkdirp(rootDirPath);
  await sync(testDir, rootDirPath);
  return rootDirPath;
}
