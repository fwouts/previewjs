import { RPCs, decodeComponentId } from "@previewjs/api";
import type { TypeAnalyzer } from "@previewjs/type-analyzer";
import { exclusivePromiseRunner } from "exclusive-promises";
import fs from "fs-extra";
import path from "path";
import type { FrameworkPlugin, Workspace } from ".";
import { getCacheDir } from "./caching";
import { findFiles } from "./find-files";
import { AnalyzableComponent } from "./plugins/framework";

export const FILES_REQUIRING_REDETECTION = new Set([
  "jsconfig.json",
  "tsconfig.json",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

type CachedProjectComponents = {
  detectionStartTimestamp: number;
  components: RPCs.Component[];
};

// Prevent concurrent running of detectComponents()
// to avoid corrupting the cache and optimise for cache hits.
const oneAtATime = exclusivePromiseRunner();

export function detectComponents(
  workspace: Workspace,
  frameworkPlugin: FrameworkPlugin,
  typeAnalyzer: TypeAnalyzer,
  options: {
    filePaths?: string[];
    forceRefresh?: boolean;
  } = {}
): Promise<RPCs.DetectComponentsResponse> {
  return oneAtATime(async () => {
    const detectionStartTimestamp = Date.now();
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
        path
          .relative(workspace.rootDirPath, absoluteFilePath)
          .replace(/\\/g, "/")
      )
    );
    let existingCache: CachedProjectComponents = fs.existsSync(cacheFilePath)
      ? (JSON.parse(
          fs.readFileSync(cacheFilePath, "utf8")
        ) as CachedProjectComponents)
      : {
          detectionStartTimestamp: 0,
          components: [],
        };
    if (
      existingCache.detectionStartTimestamp <
      (await detectionMinimalTimestamp(workspace.rootDirPath))
    ) {
      // Cache cannot be used as it was generated before detection-impacted files were updated.
      existingCache = {
        detectionStartTimestamp: 0,
        components: [],
      };
    }
    const changedAbsoluteFilePaths = absoluteFilePaths.filter(
      (absoluteFilePath) => {
        const entry = workspace.reader.readSync(absoluteFilePath);
        return (
          entry?.kind === "file" &&
          (options.forceRefresh ||
            entry.lastModifiedMillis() >= existingCache.detectionStartTimestamp)
        );
      }
    );
    const refreshedFilePaths = new Set(
      changedAbsoluteFilePaths.map((absoluteFilePath) =>
        path.relative(workspace.rootDirPath, absoluteFilePath)
      )
    );
    const recycledComponents = existingCache.components.filter(
      ({ componentId }) => {
        const filePath = decodeComponentId(componentId).filePath;
        return filePathsSet.has(filePath) && !refreshedFilePaths.has(filePath);
      }
    );
    const refreshedComponents = await detectComponentsCore(
      workspace,
      frameworkPlugin,
      typeAnalyzer,
      changedAbsoluteFilePaths
    );
    const components = [...recycledComponents, ...refreshedComponents];
    components.sort((a, b) => {
      return a.componentId.localeCompare(b.componentId);
    });
    if (!options.filePaths) {
      await fs.mkdirp(path.dirname(cacheFilePath));
      const updatedCache: CachedProjectComponents = {
        detectionStartTimestamp,
        components,
      };
      await fs.writeFile(cacheFilePath, JSON.stringify(updatedCache));
    }
    return { components };
  });
}

async function detectComponentsCore(
  workspace: Workspace,
  frameworkPlugin: FrameworkPlugin,
  typeAnalyzer: TypeAnalyzer,
  changedAbsoluteFilePaths: string[]
): Promise<RPCs.Component[]> {
  const components: RPCs.Component[] = [];
  if (changedAbsoluteFilePaths.length === 0) {
    return components;
  }
  const found = await frameworkPlugin.detectComponents(
    workspace.reader,
    typeAnalyzer,
    changedAbsoluteFilePaths
  );
  for (const component of found) {
    components.push(detectedComponentToApiComponent(component));
  }
  return components;
}

export function detectedComponentToApiComponent(
  component: AnalyzableComponent
): RPCs.Component {
  const [start, end] = component.offsets[0]!;
  return {
    componentId: component.componentId,
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
            args: component.info.args,
            associatedComponentId:
              component.info.associatedComponent.componentId,
          },
  };
}

async function detectionMinimalTimestamp(rootDirPath: string) {
  const nodeModulesPath = path.join(rootDirPath, "node_modules");
  let lastModifiedMillis = 0;
  if (await fs.pathExists(nodeModulesPath)) {
    // Find the latest subdirectory or symlink (important for pnpm).
    for (const subdirectory of await fs.readdir(nodeModulesPath)) {
      const subdirectoryPath = path.join(nodeModulesPath, subdirectory);
      const stat = await fs.lstat(subdirectoryPath);
      if (stat.isDirectory() || stat.isSymbolicLink()) {
        lastModifiedMillis = Math.max(lastModifiedMillis, stat.mtimeMs);
      }
    }
  }
  for (const f of FILES_REQUIRING_REDETECTION) {
    const filePath = path.join(rootDirPath, f);
    if (await fs.pathExists(filePath)) {
      const stat = await fs.stat(filePath);
      lastModifiedMillis = Math.max(lastModifiedMillis, stat.mtimeMs);
    }
  }
  return lastModifiedMillis;
}
