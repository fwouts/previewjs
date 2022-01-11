import { readConfig } from "@previewjs/config";
import { extractPackageDependencies, FrameworkPlugin } from "@previewjs/core";
import type { SetupPreviewEnvironment } from "@previewjs/loader";
import { reactFrameworkPlugin } from "@previewjs/plugin-react";
import { vue2FrameworkPlugin } from "@previewjs/plugin-vue2";
import { vue3FrameworkPlugin } from "@previewjs/plugin-vue3";
import express from "express";
import fs from "fs";
import path from "path";

const setup: SetupPreviewEnvironment = async ({ rootDirPath }) => {
  let frameworkPlugin: FrameworkPlugin = await readConfig(rootDirPath)
    .frameworkPlugin;
  fallbackToDefault: if (!frameworkPlugin) {
    const frameworkPluginCandidates = [
      reactFrameworkPlugin,
      vue2FrameworkPlugin,
      vue3FrameworkPlugin,
    ];
    const dependencies = await extractPackageDependencies(rootDirPath);
    for (const candidate of frameworkPluginCandidates) {
      if (await candidate.isCompatible(dependencies)) {
        frameworkPlugin = await candidate.create();
        break fallbackToDefault;
      }
    }
    return null;
  }
  return {
    frameworkPlugin,
    middlewares: [express.static(findClientDir(__dirname))],
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
