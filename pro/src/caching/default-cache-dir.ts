import fs from "fs";
import path from "path";

export function getDefaultCacheDir(rootDirPath: string) {
  try {
    const { version } = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "..", "..", "..", "package.json"),
        "utf8"
      )
    );
    return path.join(rootDirPath, "node_modules", ".previewjs", `${version}`);
  } catch (e) {
    throw new Error(`Unable to detect current version.`);
  }
}
