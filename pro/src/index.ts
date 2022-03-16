import type {
  PreviewEnvironment,
  SetupPreviewEnvironment,
} from "@previewjs/core";
import { reactFrameworkPlugin } from "@previewjs/plugin-react";
import { vue2FrameworkPlugin } from "@previewjs/plugin-vue2";
import { vue3FrameworkPlugin } from "@previewjs/plugin-vue3";
import express from "express";
import fs from "fs";
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
      middlewares: [express.static(findClientDir(__dirname))],
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

function findClientDir(dirPath: string): string {
  const potentialPath = path.join(dirPath, "client", "dist");
  if (fs.existsSync(potentialPath)) {
    return potentialPath;
  } else {
    const parentPath = path.dirname(dirPath);
    if (!parentPath || parentPath === dirPath) {
      throw new Error(`Unable to find compiled client directory (client/dist)`);
    }
    return findClientDir(parentPath);
  }
}

export default setup;
