import {
  createWorkspace,
  FrameworkPluginFactory,
  setupFrameworkPlugin,
} from "@previewjs/core";
import { createFileSystemReader, Reader } from "@previewjs/vfs";
import express from "express";
import fs from "fs";
import path from "path";

export async function createChromelessWorkspace({
  rootDirPath,
  frameworkPluginFactories,
  reader = createFileSystemReader(),
}: {
  rootDirPath: string;
  frameworkPluginFactories: FrameworkPluginFactory[];
  reader?: Reader;
  port?: number;
}) {
  const frameworkPlugin = await setupFrameworkPlugin({
    rootDirPath,
    frameworkPluginFactories,
  });
  if (!frameworkPlugin) {
    throw new Error(
      `No compatible framework plugin found for directory: ${rootDirPath}`
    );
  }
  const clientDirPath = findClientDir(__dirname);
  const workspace = await createWorkspace({
    rootDirPath,
    frameworkPlugin,
    logLevel: "info",
    versionCode: "0.0.0-dev",
    reader,
    setupEnvironment: async () => ({
      middlewares: [express.static(clientDirPath)],
    }),
  });
  if (!workspace) {
    throw new Error(
      `No workspace could be created for directory: ${rootDirPath}`
    );
  }
  return workspace;
}

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
