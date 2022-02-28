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
import { AnalyzeFileEndpoint } from "./api/endpoints";

const setup: SetupPreviewEnvironment =
  async (): Promise<PreviewEnvironment | null> => {
    return {
      frameworkPluginFactories: [
        reactFrameworkPlugin,
        vue2FrameworkPlugin,
        vue3FrameworkPlugin,
      ],
      middlewares: [express.static(path.join(__dirname, "../client/build"))],
      onReady: async ({ router, workspace }) => {
        router.onRequest(AnalyzeFileEndpoint, async ({ filePath }) => ({
          components: await analyzeFile({
            workspace,
            filePath,
          }),
        }));
      },
    };
  };

export default setup;
