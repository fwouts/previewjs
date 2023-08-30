import type { FrameworkPluginFactory, Workspace } from "@previewjs/core";
import { createWorkspace } from "@previewjs/core";
import type { Reader } from "@previewjs/vfs";
import express from "express";
import path from "path";
import type { Logger } from "pino";
import type { Page } from "playwright";
import url from "url";
import { startPreview } from "./preview";

export async function createChromelessWorkspace({
  rootDir,
  frameworkPlugins,
  reader,
  logger,
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
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
  const clientDirPath = path.join(__dirname, "..", "client", "dist");
  const workspace = await createWorkspace({
    rootDir,
    frameworkPlugins,
    logger,
    reader,
    onServerStart: async () => ({
      middlewares: [express.static(clientDirPath)],
    }),
  });
  return {
    ...workspace,
    startPreview: (page: Page, options: { port?: number } = {}) =>
      startPreview({ workspace, page, ...options }),
  };
}
