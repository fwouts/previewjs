import { ComponentDetector } from "@previewjs/core";
import { createFileSystemReader } from "@previewjs/core/vfs";
import { PreviewEnvironment, SetupPreviewEnvironment } from "@previewjs/loader";
import { ReactComponent } from "@previewjs/plugin-react";
import express from "express";
import path from "path";
import { analyzeFile } from "./actions/analyze-file";
import { analyzeProject } from "./actions/analyze-project";
import { AnalyzerPlugin } from "./analysis/analyzer-plugin";
import { reactAnalyzerPlugin } from "./analysis/react";
import { vue3AnalyzerPlugin } from "./analysis/vue3";
import { AnalyzeFileEndpoint, AnalyzeProjectEndpoint } from "./api/endpoints";
import { loadFrameworkPlugin } from "./load-plugin";
import { CollectedTypes } from "./types/analysis/definitions";

const setup: SetupPreviewEnvironment = async ({
  rootDirPath,
  reader,
}): Promise<PreviewEnvironment | null> => {
  reader ||= createFileSystemReader();
  const collected: CollectedTypes = {};
  const frameworkPlugin = await loadFrameworkPlugin(rootDirPath);
  if (!frameworkPlugin) {
    return null;
  }
  let analyzerPlugin: AnalyzerPlugin | null = null;
  if (frameworkPlugin.name === "@previewjs/plugin-react") {
    analyzerPlugin = reactAnalyzerPlugin(
      frameworkPlugin.componentDetector as ComponentDetector<ReactComponent>
    );
  } else if (frameworkPlugin.name === "@previewjs/plugin-vue3") {
    analyzerPlugin = vue3AnalyzerPlugin(frameworkPlugin.componentDetector);
  }
  return {
    frameworkPlugin,
    reader: analyzerPlugin?.provideReader(reader) || reader,
    middlewares: [
      express.static(
        path.join(
          __dirname,
          process.env["APP_DIR_PATH"] || "../../client/build"
        )
      ),
    ],
    onReady: async ({ router, componentAnalyzer, typescriptAnalyzer }) => {
      router.onRequest(AnalyzeFileEndpoint, async ({ relativeFilePath }) => ({
        components: await analyzeFile({
          reader,
          rootDirPath,
          relativeFilePath,
          detectComponents: (filePath) => {
            const program = typescriptAnalyzer?.analyze([filePath]);
            if (!program) {
              return [];
            }
            return frameworkPlugin.componentDetector(program, [filePath]);
          },
        }),
      }));
      router.onRequest(AnalyzeProjectEndpoint, async ({ forceRefresh }) =>
        analyzeProject(rootDirPath, { forceRefresh })
      );
    },
  };
};

export default setup;
