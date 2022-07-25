import globby from "globby";

export async function findFiles(rootDirPath: string, pattern: string) {
  const files: string[] = await globby(pattern, {
    gitignore: true,
    ignore: ["**/node_modules/**"],
    cwd: rootDirPath,
    absolute: true,
    followSymbolicLinks: false,
  });

  // Note: in some cases, presumably because of yarn using link
  // for faster node_modules, glob may return files in the parent
  // directory. We filter them out here.
  return files.filter((f) =>
    f.startsWith(rootDirPath.replace(/\\/g, "/") + "/")
  );
}
