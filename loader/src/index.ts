import type {
  ComponentAnalyzer,
  FrameworkPluginFactory,
  Workspace,
} from "@previewjs/core";
import type { ApiRouter } from "@previewjs/core/router";
import type { TypescriptAnalyzer } from "@previewjs/core/ts-helpers";
import type { Reader } from "@previewjs/core/vfs";
import type { RequestHandler } from "express";

// Initialise __non_webpack_require__ for non-webpack environments.
if (!global.__non_webpack_require__) {
  global.__non_webpack_require__ = require;
}

export type SetupPreviewEnvironment = (options: {
  rootDirPath: string;
}) => Promise<PreviewEnvironment | null>;

export type LogLevel = "silent" | "error" | "warn" | "info";

export type PreviewEnvironment = {
  frameworkPluginFactories?: FrameworkPluginFactory[];
  middlewares?: RequestHandler[];
  onReady?(options: {
    reader: Reader;
    router: ApiRouter;
    componentAnalyzer: ComponentAnalyzer;
    typescriptAnalyzer: TypescriptAnalyzer;
    workspace: Workspace;
  }): Promise<void>;
};

export { install, isInstalled } from "./installer";
export { init, load } from "./runner";
