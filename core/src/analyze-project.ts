import { readConfig } from "@previewjs/config";
import fs from "fs-extra";
import glob from "glob";
import path from "path";
import { promisify } from "util";
import { Workspace } from ".";
import { getCacheDir } from "./caching";

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

export async function analyzeProject(
  workspace: Workspace,
  options: {
    forceRefresh?: boolean;
  } = {}
): Promise<ProjectAnalysis> {
  const cacheFilePath = path.join(
    getCacheDir(workspace.rootDirPath),
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
  const components = await analyzeProjectCore(workspace);
  await fs.mkdirp(path.dirname(cacheFilePath));
  await fs.writeFile(cacheFilePath, JSON.stringify(components));
  return { components, cached: false };
}

async function analyzeProjectCore(
  workspace: Workspace
): Promise<ProjectComponents> {
  const absoluteFilePaths = await findFiles(
    workspace.rootDirPath,
    "**/*.@(js|jsx|ts|tsx|svelte|vue)"
  );
  const components: Record<
    string,
    Array<{
      componentName: string;
      exported: boolean;
    }>
  > = {};
  const found = await workspace.frameworkPlugin.detectComponents(
    workspace.typeAnalyzer,
    absoluteFilePaths
  );
  for (const component of found) {
    const filePath = path.relative(
      workspace.rootDirPath,
      component.absoluteFilePath
    );
    const fileComponents = (components[filePath] ||= []);
    fileComponents.push({
      componentName: component.name,
      exported: component.exported,
    });
  }
  workspace.dispose();
  return components;
}

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
