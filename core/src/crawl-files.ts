import { decodePreviewableId } from "@previewjs/analyzer-api";
import { RPCs } from "@previewjs/api";
import { exclusivePromiseRunner } from "exclusive-promises";
import fs from "fs-extra";
import path from "path";
import type { Logger } from "pino";
import { getCacheDir } from "./caching.js";
import { findFiles } from "./find-files.js";
import type { FrameworkPlugin, Workspace } from "./index.js";

export const FILES_REQUIRING_REDETECTION = new Set([
  "jsconfig.json",
  "tsconfig.json",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

type CachedPreviewables = {
  detectionStartTimestamp: number;
  components: RPCs.Component[];
  stories: RPCs.Story[];
};

// Prevent concurrent running of crawlFiles()
// to avoid corrupting the cache and optimise for cache hits.
const oneAtATime = exclusivePromiseRunner();

export function crawlFiles(
  logger: Logger,
  workspace: Workspace,
  frameworkPlugin: FrameworkPlugin,
  options: {
    filePaths?: string[];
    forceRefresh?: boolean;
  } = {}
): Promise<RPCs.CrawlFilesResponse> {
  return oneAtATime(async () => {
    logger.debug(
      `Detecting components with options: ${JSON.stringify(options)}`
    );
    const detectionStartTimestamp = Date.now();
    const cacheFilePath = path.join(
      getCacheDir(workspace.rootDir),
      "components.json"
    );
    const absoluteFilePaths = await (async () => {
      if (options.filePaths) {
        return options.filePaths.map((filePath) =>
          path.join(workspace.rootDir, filePath)
        );
      } else {
        logger.debug(`Finding component files from root: ${workspace.rootDir}`);
        const filePaths = await findFiles(
          workspace.rootDir,
          "**/*.@(js|jsx|ts|tsx|svelte|vue)"
        );
        logger.debug(`Found ${filePaths.length} component files`);
        return filePaths;
      }
    })();
    const filePathsSet = new Set(
      absoluteFilePaths.map((absoluteFilePath) =>
        path.relative(workspace.rootDir, absoluteFilePath).replace(/\\/g, "/")
      )
    );
    let existingCache: CachedPreviewables = {
      detectionStartTimestamp: 0,
      components: [],
      stories: [],
    };
    if (fs.existsSync(cacheFilePath)) {
      try {
        existingCache = JSON.parse(
          fs.readFileSync(cacheFilePath, "utf8")
        ) as CachedPreviewables;
      } catch {
        logger.warn(`Unable to parse JSON from cache at ${cacheFilePath}`);
      }
    }
    if (
      existingCache.detectionStartTimestamp <
      (await detectionMinimalTimestamp(workspace.rootDir))
    ) {
      // Cache cannot be used as it was generated before detection-impacted files were updated.
      existingCache = {
        detectionStartTimestamp: 0,
        components: [],
        stories: [],
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
        path.relative(workspace.rootDir, absoluteFilePath).replace(/\\/g, "/")
      )
    );
    const shouldRecycle = ({ id }: { id: string }) => {
      const filePath = decodePreviewableId(id).filePath;
      return filePathsSet.has(filePath) && !refreshedFilePaths.has(filePath);
    };
    const recycledComponents = existingCache.components.filter(shouldRecycle);
    const recycledStories = existingCache.stories.filter(shouldRecycle);
    const { components: refreshedComponents, stories: refreshedStories } =
      await analyzeCore(
        logger,
        workspace,
        frameworkPlugin,
        changedAbsoluteFilePaths
      );
    const components = [...recycledComponents, ...refreshedComponents];
    const stories = [...recycledStories, ...refreshedStories];
    if (!options.filePaths) {
      await fs.mkdirp(path.dirname(cacheFilePath));
      const updatedCache: CachedPreviewables = {
        detectionStartTimestamp,
        components,
        stories,
      };
      await fs.writeFile(cacheFilePath, JSON.stringify(updatedCache));
    }
    return { components, stories };
  });
}

async function analyzeCore(
  logger: Logger,
  workspace: Workspace,
  frameworkPlugin: FrameworkPlugin,
  changedAbsoluteFilePaths: string[]
): Promise<{
  components: RPCs.Component[];
  stories: RPCs.Story[];
}> {
  const components: RPCs.Component[] = [];
  const stories: RPCs.Story[] = [];
  if (changedAbsoluteFilePaths.length === 0) {
    return { components, stories };
  }
  logger.debug(
    `Running component detection with file paths:\n- ${changedAbsoluteFilePaths
      .map((absoluteFilePath) =>
        path.relative(workspace.rootDir, absoluteFilePath)
      )
      .join("\n- ")}`
  );
  const found = await frameworkPlugin.crawlFiles(changedAbsoluteFilePaths);
  logger.debug(`Done running component detection`);
  for (const component of found.components) {
    components.push({
      id: component.id,
      sourcePosition: component.sourcePosition,
      exported: component.exported,
    });
  }
  for (const story of found.stories) {
    stories.push({
      id: story.id,
      sourcePosition: story.sourcePosition,
      associatedComponentId: story.associatedComponent?.id || null,
    });
  }
  return { components, stories };
}

async function detectionMinimalTimestamp(rootDir: string) {
  const nodeModulesPath = path.join(rootDir, "node_modules");
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
    const filePath = path.join(rootDir, f);
    if (await fs.pathExists(filePath)) {
      const stat = await fs.stat(filePath);
      lastModifiedMillis = Math.max(lastModifiedMillis, stat.mtimeMs);
    }
  }
  return lastModifiedMillis;
}
