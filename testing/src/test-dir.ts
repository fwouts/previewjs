import fs from "fs-extra";
import path from "path";
import { sync } from "./sync";

export function prepareTestDir(testDir: string) {
  const rootDirPath = path.join(
    testDir,
    "..",
    "_tmp_",
    Buffer.from(`${path.basename(testDir)}-${process.pid}`, "utf8").toString(
      "base64"
    )
  );
  fs.mkdirpSync(rootDirPath);
  // Ensure we don't have a cache directory.
  const cacheDirPath = path.join(testDir, "node_modules", ".previewjs");
  if (fs.pathExistsSync(cacheDirPath)) {
    fs.removeSync(cacheDirPath);
  }
  sync(testDir, rootDirPath);
  return rootDirPath;
}
