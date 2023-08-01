import fs from "fs-extra";
import path from "path";
import type * as vite from "vite";

/**
 * Allows imports of assets from the public directory.
 *
 * Example: `import viteLogo from "/vite.svg";`
 */
export function publicAssetImportPluginPlugin({
  rootDir,
  publicDir,
}: {
  rootDir: string;
  publicDir: string;
}): vite.Plugin {
  return {
    name: "previewjs:public-asset-import",
    resolveId: async (source, importer) => {
      if (
        !importer ||
        !source.startsWith("/") ||
        source.startsWith("/__previewjs__/")
      ) {
        return;
      }
      const publicDirAbsolutePath = path.join(rootDir, publicDir);
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
