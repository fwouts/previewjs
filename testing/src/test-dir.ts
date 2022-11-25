import fs from "fs-extra";
import path from "path";
import { sync } from "./sync";

export function prepareTestDir(testDir: string) {
  const rootDirPath = path.join(
    testDir,
    "..",
    "_tmp_",
    `${path.basename(testDir)}-${process.pid}`
  );
  fs.mkdirpSync(rootDirPath);
  sync(testDir, rootDirPath);
  return rootDirPath;
}
