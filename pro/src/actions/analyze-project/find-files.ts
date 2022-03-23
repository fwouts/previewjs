import { readConfig } from "@previewjs/config";
import glob from "glob";
import { promisify } from "util";

export async function findFiles(rootDirPath: string, pattern: string) {
  const config = (await readConfig(rootDirPath)) as {
    exclude?: string[];
  };
  const files = await promisify(glob)(pattern, {
    ignore: ["**/node_modules/**", ...(config.exclude || [])],
    cwd: rootDirPath,
    nodir: true,
    absolute: true,
    follow: false,
  });
  // Note: in some cases, presumably because of yarn using link
  // for faster node_modules, glob may return files in the parent
  // directory. We filter them out here.
  return files.filter((f) =>
    f.startsWith(rootDirPath.replace(/\\/g, "/") + "/")
  );
}
