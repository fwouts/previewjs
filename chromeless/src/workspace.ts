import {
  createWorkspace,
  FrameworkPluginFactory,
  loadPreviewEnv,
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
  const env = await loadPreviewEnv({
    rootDirPath,
    setupEnvironment: async () => ({}),
    frameworkPluginFactories,
  });
  if (!env) {
    throw new Error(
      `No preview environment could be created for directory: ${rootDirPath}`
    );
  }
  const clientDirPath = findClientDir(__dirname);
  const workspace = await createWorkspace({
    rootDirPath,
    frameworkPlugin: env.frameworkPlugin,
    logLevel: "info",
    versionCode: "0.0.0-dev",
    middlewares: [express.static(clientDirPath)],
    reader,
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
