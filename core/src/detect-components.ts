import type { RPCs } from "@previewjs/api";
import type { TypeAnalyzer } from "@previewjs/type-analyzer";
import fs from "fs-extra";
import path from "path";
import type { FrameworkPlugin, Workspace } from ".";
import { getCacheDir } from "./caching";
import { findFiles } from "./find-files";

type ProjectComponents = RPCs.DetectComponentsResponse["components"];

export async function detectComponents(
  workspace: Workspace,
  frameworkPlugin: FrameworkPlugin,
  typeAnalyzer: TypeAnalyzer,
  options: {
    filePaths?: string[];
    forceRefresh?: boolean;
  } = {}
): Promise<RPCs.DetectComponentsResponse> {
  const cacheFilePath = path.join(
    getCacheDir(workspace.rootDirPath),
    "components.json"
  );
  const absoluteFilePaths = options.filePaths
    ? options.filePaths.map((filePath) =>
        path.join(workspace.rootDirPath, filePath)
      )
    : await findFiles(
        workspace.rootDirPath,
        "**/*.@(js|jsx|ts|tsx|svelte|vue)"
      );
  const filePathsSet = new Set(
    absoluteFilePaths.map((absoluteFilePath) =>
      path.relative(workspace.rootDirPath, absoluteFilePath).replace(/\\/g, "/")
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
    (absoluteFilePath) => {
      const entry = workspace.reader.readSync(absoluteFilePath);
      return (
        entry?.kind === "file" &&
        entry.lastModifiedMillis() > existingCacheLastModified
      );
    }
  );
  const recycledComponents = Object.fromEntries(
    Object.entries(existingCache).filter(([filePath]) =>
      filePathsSet.has(filePath)
    )
  );
  const refreshedComponents = await detectComponentsCore(
    workspace,
    frameworkPlugin,
    typeAnalyzer,
    changedAbsoluteFilePaths
  );
  const allComponents = {
    ...recycledComponents,
    ...refreshedComponents,
  };
  const components = Object.keys(allComponents)
    .sort()
    .reduce<ProjectComponents>((ordered, filePath) => {
      ordered[filePath] = allComponents[filePath]!;
      return ordered;
    }, {});
  if (!options.filePaths) {
    await fs.mkdirp(path.dirname(cacheFilePath));
    await fs.writeFile(cacheFilePath, JSON.stringify(components));
  }
  return { components };
}

async function detectComponentsCore(
  workspace: Workspace,
  frameworkPlugin: FrameworkPlugin,
  typeAnalyzer: TypeAnalyzer,
  changedAbsoluteFilePaths: string[]
): Promise<ProjectComponents> {
  const components: ProjectComponents = {};
  if (changedAbsoluteFilePaths.length === 0) {
    return components;
  }
  const found = await frameworkPlugin.detectComponents(
    typeAnalyzer,
    changedAbsoluteFilePaths
  );
  for (const component of found) {
    const filePath = path
      .relative(workspace.rootDirPath, component.absoluteFilePath)
      .replace(/\\/g, "/");
    const fileComponents = (components[filePath] ||= []);
    const [start, end] = component.offsets[0]!;
    fileComponents.push({
      name: component.name,
      start,
      end,
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
