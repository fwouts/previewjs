import type { FrameworkPluginFactory, Workspace } from "@previewjs/core";
import { createWorkspace, setupFrameworkPlugin } from "@previewjs/core";
import type { Reader } from "@previewjs/vfs";
import { createFileSystemReader } from "@previewjs/vfs";
import express from "express";
import type { Logger } from "pino";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import type { Page } from "playwright";
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
}): Promise<
  Omit<Workspace, "startServer"> & {
    startPreview: (
      page: Page,
      options?: { port?: number }
    ) => ReturnType<typeof startPreview>;
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
  const workspace = await createWorkspace({
    rootDir,
    frameworkPlugin,
    logger,
    reader,
    onServerStart: async () => ({
      middlewares: [
        ((req, res, next) => {
          if (req.path === "/") {
            res.write("Go to /preview/[id]");
            res.end();
          } else {
            next();
          }
        }) satisfies express.RequestHandler,
      ],
    }),
  });
  if (!workspace) {
    throw new Error(`No workspace could be created for directory: ${rootDir}`);
  }
  return {
    ...workspace,
    startPreview: (page: Page, options: { port?: number } = {}) =>
      startPreview({ workspace, page, ...options }),
  };
}
