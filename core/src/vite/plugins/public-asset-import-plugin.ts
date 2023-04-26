import fs from "fs-extra";
import path from "path";
import type * as vite from "vite";
import { COMPONENT_LOADER_MODULE } from "./component-loader-plugin";

/**
 * Allows imports of assets from the public directory.
 *
 * Example: `import viteLogo from "/vite.svg";`
 */
export function publicAssetImportPluginPlugin({
  rootDirPath,
  publicDir,
}: {
  rootDirPath: string;
  publicDir: string;
}): vite.Plugin {
  return {
    name: "previewjs:public-asset-import",
    resolveId: async (source, importer) => {
      if (
        !importer ||
        !source.startsWith("/") ||
        source.startsWith("/__previewjs__/") ||
        source.startsWith(COMPONENT_LOADER_MODULE)
      ) {
        return;
      }
      const publicDirAbsolutePath = path.join(rootDirPath, publicDir);
      const potentialPublicFilePath = path.join(publicDirAbsolutePath, source);
      if (
        !potentialPublicFilePath.startsWith(publicDirAbsolutePath + path.sep)
      ) {
        // Block attempts to move out of the directory.
        return;
      }
      if (!(await fs.pathExists(potentialPublicFilePath))) {
        return;
      }
      return source;
    },
  };
}
