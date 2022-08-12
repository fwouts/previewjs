import fs from "fs";
import path from "path";

export function getCacheDir(rootDirPath: string) {
  try {
    const { version } = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8")
    );
    return path.resolve(
      rootDirPath,
      "node_modules",
      ".previewjs",
      `v${version}`
    );
  } catch (e) {
    throw new Error(`Unable to detect @previewjs/core version.`);
  }
}
