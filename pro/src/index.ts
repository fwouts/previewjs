import type {
  PreviewEnvironment,
  SetupPreviewEnvironment,
} from "@previewjs/core";
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
    middlewares: [express.static(path.join(__dirname, "../client/build"))],
    onReady: async ({ reader, router, workspace }) => {
      router.onRequest(AnalyzeFileEndpoint, async ({ relativeFilePath }) => ({
        components: await analyzeFile({
          workspace,
          relativeFilePath,
        }),
      }));
      router.onRequest(AnalyzeProjectEndpoint, async ({ forceRefresh }) =>
        analyzeProject(rootDirPath, { forceRefresh })
      );
    },
  };
};

export default setup;
