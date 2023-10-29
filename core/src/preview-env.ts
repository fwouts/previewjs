import type * as express from "express";
import type { Workspace } from "./index.js";
import type { RegisterRPC } from "./router.js";

export type OnServerStart = (options: {
  versionCode?: string;
  registerRPC: RegisterRPC;
  workspace: Workspace;
}) => Promise<{
  middlewares?: express.RequestHandler[];
}>;
