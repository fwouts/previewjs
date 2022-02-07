import type * as core from "@previewjs/core";
import { ApiRouter } from "@previewjs/core/router";
import { TypescriptAnalyzer } from "@previewjs/core/ts-helpers";
import type { RequestHandler } from "express";

// Initialise __non_webpack_require__ for non-webpack environments.
if (!global.__non_webpack_require__) {
  global.__non_webpack_require__ = require;
}

export type SetupPreviewEnvironment = (options: {
  rootDirPath: string;
  versionCode: string;
  logLevel: LogLevel;
  reader: core.vfs.Reader;
  persistedStateManager?: core.PersistedStateManager;
}) => Promise<PreviewEnvironment | null>;

export type LogLevel = "silent" | "error" | "warn" | "info";

export type PreviewEnvironment = {
  frameworkPlugin: core.FrameworkPlugin;
  middlewares?: RequestHandler[];
  reader?: core.vfs.Reader;
  onReady?(options: {
    router: ApiRouter;
    typescriptAnalyzer: TypescriptAnalyzer;
  }): Promise<void>;
  onFileChanged?(filePath: string): Promise<void>;
};

export { install, isInstalled } from "./installer";
export { init, load } from "./runner";
