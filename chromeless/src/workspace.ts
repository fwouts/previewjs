import { createWorkspace, setupFrameworkPlugin } from "@previewjs/core";
import type { FrameworkPluginFactory } from "@previewjs/core";
import { createFileSystemReader } from "@previewjs/vfs";
import type { Reader } from "@previewjs/vfs";
import express from "express";
import path from "path";
import url from "url";

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
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
  const clientDirPath = path.join(__dirname, "..", "client", "dist");
  const workspace = await createWorkspace({
    rootDirPath,
    frameworkPlugin,
    logLevel: "info",
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
