import { fork } from "child_process";
import fs from "fs-extra";
import path from "path";
import { getDefaultCacheDir } from "../caching/default-cache-dir";
import { analyzeProjectCore } from "./analyze-project/core";

export async function analyzeProject(
  rootDirPath: string,
  options: {
    forceRefresh?: boolean;
  } = {}
): Promise<ProjectAnalysis> {
  const cacheFilePath = path.join(
    getDefaultCacheDir(rootDirPath),
    "components.json"
  );
  useCache: if (!options.forceRefresh && (await fs.pathExists(cacheFilePath))) {
    const stat = await fs.stat(cacheFilePath);
    if (stat.mtimeMs < Date.now() - 24 * 3600 * 1000) {
      // We want to force refresh once a day at least.
      break useCache;
    }
    return {
      components: JSON.parse(await fs.readFile(cacheFilePath, "utf8")),
      cached: true,
    };
  }
  const components = await analyzeBackground(rootDirPath);
  await fs.mkdirp(path.dirname(cacheFilePath));
  await fs.writeFile(cacheFilePath, JSON.stringify(components));
  return { components, cached: false };
}

async function analyzeBackground(rootDirPath: string) {
  if (process.env["JEST_WORKER_ID"]) {
    // Jest + TypeScript + fork = unhappy days.
    return await analyzeProjectCore(rootDirPath);
  }
  const subprocess = fork(
    path.join(__dirname, "analyze-project", "subprocess"),
    [rootDirPath],
    {
      cwd: process.cwd(),
      silent: true,
    }
  );
  subprocess.stderr!.pipe(process.stderr);
  let subprocessErrorOutput = "";
  subprocess.stderr!.on("data", (data) => {
    subprocessErrorOutput += `${data}`;
  });
  const components = await new Promise<
    Record<
      string,
      Array<{
        componentName: string;
        exported: boolean;
      }>
    >
  >((resolve, reject) => {
    subprocess.on("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(subprocessErrorOutput));
      }
    });
    subprocess.on("message", resolve);
  });
  return components;
}

export interface ProjectAnalysis {
  components: ProjectComponents;
  cached: boolean;
}

export type ProjectComponents = Record<
  string,
  Array<{
    componentName: string;
    exported: boolean;
  }>
>;
