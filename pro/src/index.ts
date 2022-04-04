import type {
  PreviewEnvironment,
  SetupPreviewEnvironment,
} from "@previewjs/core";
import { reactFrameworkPlugin } from "@previewjs/plugin-react";
import { solidFrameworkPlugin } from "@previewjs/plugin-solid";
import { vue2FrameworkPlugin } from "@previewjs/plugin-vue2";
import { vue3FrameworkPlugin } from "@previewjs/plugin-vue3";
import express from "express";
import fs from "fs";
import path from "path";
import { analyzeFile } from "./actions/analyze-file";
import { analyzeProject } from "./actions/analyze-project";
import { AnalyzeFileEndpoint, AnalyzeProjectEndpoint } from "./api/endpoints";

const setup: SetupPreviewEnvironment =
  async (): Promise<PreviewEnvironment | null> => {
    return {
      frameworkPluginFactories: [
        reactFrameworkPlugin,
        solidFrameworkPlugin,
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
        router.onRequest(AnalyzeProjectEndpoint, async ({ forceRefresh }) =>
          analyzeProject(workspace.rootDirPath, { forceRefresh })
        );
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
