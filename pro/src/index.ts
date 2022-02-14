import { PreviewEnvironment, SetupPreviewEnvironment } from "@previewjs/loader";
import { reactFrameworkPlugin } from "@previewjs/plugin-react";
import { vue2FrameworkPlugin } from "@previewjs/plugin-vue2";
import { vue3FrameworkPlugin } from "@previewjs/plugin-vue3";
import express from "express";
import path from "path";
import { analyzeFile } from "./actions/analyze-file";
import { analyzeProject } from "./actions/analyze-project";
import { AnalyzeFileEndpoint, AnalyzeProjectEndpoint } from "./api/endpoints";

const setup: SetupPreviewEnvironment = async ({
  rootDirPath,
}): Promise<PreviewEnvironment | null> => {
  return {
    frameworkPluginFactories: [
      reactFrameworkPlugin,
      vue2FrameworkPlugin,
      vue3FrameworkPlugin,
    ],
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
