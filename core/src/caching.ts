import fs from "fs";
import path from "path";
import url from "url";

export function getCacheDir(rootDir: string) {
  try {
    const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
    const { version } = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8")
    );
    return path.resolve(rootDir, "node_modules", ".previewjs", `v${version}`);
  } catch (e) {
    throw new Error(`Unable to detect @previewjs/core version.\n${e}`);
  }
}
