import type { FrameworkPluginFactory, Workspace } from "@previewjs/core";
import { createWorkspace, setupFrameworkPlugin } from "@previewjs/core";
import type { Reader } from "@previewjs/vfs";
import { createFileSystemReader } from "@previewjs/vfs";
import express from "express";
import path from "path";
import type { Logger } from "pino";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import type { Page } from "playwright";
import url from "url";
import { startPreview } from "./preview";

export async function createChromelessWorkspace({
  rootDir,
  frameworkPlugins,
  reader = createFileSystemReader(),
  logger = createLogger(
    {
      ...(process.env["PREVIEWJS_LOG_LEVEL"]
        ? { level: process.env["PREVIEWJS_LOG_LEVEL"].toLowerCase() }
        : {}),
    },
    prettyLogger({ colorize: true, destination: process.stdout })
  ),
}: {
  rootDir: string;
  frameworkPlugins: FrameworkPluginFactory[];
  logger?: Logger;
  reader?: Reader;
  port?: number;
}): Promise<
  Omit<Workspace, "preview"> & {
    preview: {
      start: (
        page: Page,
        options?: { port?: number }
      ) => ReturnType<typeof startPreview>;
    };
  }
> {
  const frameworkPlugin = await setupFrameworkPlugin({
    rootDir,
    frameworkPlugins,
    reader,
    logger,
  });
  if (!frameworkPlugin) {
    throw new Error(
      `No compatible framework plugin found for directory: ${rootDir}`
    );
  }
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
  const clientDirPath = path.join(__dirname, "..", "client", "dist");
  const workspace = await createWorkspace({
    rootDir,
    frameworkPlugin,
    logger,
    reader,
    setupEnvironment: async () => ({
      middlewares: [express.static(clientDirPath)],
    }),
  });
  if (!workspace) {
    throw new Error(`No workspace could be created for directory: ${rootDir}`);
  }
  return {
    ...workspace,
    preview: {
      start: (page: Page, options: { port?: number } = {}) =>
        startPreview({ workspace, page, ...options }),
    },
  };
}
