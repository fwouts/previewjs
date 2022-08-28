import fs from "fs-extra";
import path from "path";
import type { Workspace } from ".";
import { getCacheDir } from "./caching";
import { findFiles } from "./find-files";

export interface ProjectAnalysis {
  components: ProjectComponents;
  cached: boolean;
}

export type ProjectComponents = {
  [filePath: string]: Array<SimplifiedComponent>;
};

export type SimplifiedComponent = {
  name: string;
  info:
    | {
        kind: "component";
        exported: boolean;
      }
    | {
        kind: "story";
        associatedComponent: {
          filePath: string;
          name: string;
        } | null;
      };
};

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
  const absoluteFilePaths = await findFiles(
    workspace.rootDirPath,
    "**/*.@(js|jsx|ts|tsx|svelte|vue)"
  );
  const filePathsSet = new Set(
    absoluteFilePaths.map((absoluteFilePath) =>
      path.relative(workspace.rootDirPath, absoluteFilePath)
    )
  );
  const existingCacheLastModified =
    !options.forceRefresh && fs.existsSync(cacheFilePath)
      ? fs.statSync(cacheFilePath).mtimeMs
      : 0;
  const existingCache: ProjectComponents = existingCacheLastModified
    ? JSON.parse(fs.readFileSync(cacheFilePath, "utf8"))
    : {};
  const changedAbsoluteFilePaths = absoluteFilePaths.filter(
    (absoluteFilePath) =>
      fs.statSync(absoluteFilePath).mtimeMs > existingCacheLastModified
  );
  const recycledComponents = Object.fromEntries(
    Object.entries(existingCache).filter(([filePath]) =>
      filePathsSet.has(filePath)
    )
  );
  const refreshedComponents = await analyzeProjectCore(
    workspace,
    changedAbsoluteFilePaths
  );
  const components = {
    ...recycledComponents,
    ...refreshedComponents,
  };
  await fs.mkdirp(path.dirname(cacheFilePath));
  await fs.writeFile(cacheFilePath, JSON.stringify(components));
  return { components, cached: false };
}

async function analyzeProjectCore(
  workspace: Workspace,
  changedAbsoluteFilePaths: string[]
): Promise<ProjectComponents> {
  const components: ProjectComponents = {};
  const found = await workspace.frameworkPlugin.detectComponents(
    workspace.typeAnalyzer,
    changedAbsoluteFilePaths
  );
  for (const component of found) {
    const filePath = path.relative(
      workspace.rootDirPath,
      component.absoluteFilePath
    );
    const fileComponents = (components[filePath] ||= []);
    fileComponents.push({
      name: component.name,
      info:
        component.info.kind === "component"
          ? {
              kind: "component",
              exported: component.info.exported,
            }
          : {
              kind: "story",
              associatedComponent: component.info.associatedComponent
                ? {
                    filePath: path.relative(
                      workspace.rootDirPath,
                      component.info.associatedComponent.absoluteFilePath
                    ),
                    name: component.info.associatedComponent.name,
                  }
                : null,
            },
    });
  }
  return components;
}
