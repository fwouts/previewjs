import type { Preview, Workspace } from "@previewjs/core";
import { load } from "@previewjs/loader";
import express from "express";
import path from "path";
import * as uuid from "uuid";
import {
  AnalyzeFileRequest,
  AnalyzeFileResponse,
  DisposeWorkspaceRequest,
  DisposeWorkspaceResponse,
  GetWorkspaceRequest,
  GetWorkspaceResponse,
  StartPreviewRequest,
  StartPreviewResponse,
  StopPreviewRequest,
  StopPreviewResponse,
  UpdatePendingFileRequest,
  UpdatePendingFileResponse,
} from "./api";

const port = parseInt(process.env["PORT"] || "9100");
const version = process.env["PREVIEWJS_INTELLIJ_VERSION"];

if (!version) {
  throw new Error(`IntelliJ version was not set`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  const packageName = process.env["PREVIEWJS_PACKAGE_NAME"];
  if (!packageName) {
    throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
  }
  const previewjs = await load({
    installDir: path.join(__dirname, "installed"),
    packageName,
  });

  const workspaces: Record<string, Workspace> = {};
  const previews: Record<string, Preview> = {};

  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({
      ready: true,
    });
  });

  function endpoint<Request, Response>(
    path: string,
    f: (req: Request) => Promise<Response>
  ) {
    app.post<{}, Response, Request>(path, async (req, res) => {
      try {
        res.json(await f(req.body));
      } catch (e: any) {
        if (e instanceof NotFoundError) {
          res.status(404).end();
        } else {
          console.error(`Error in endpoint ${path}:`);
          console.error(e);
          res.status(500).end(e.message || "Internal Error");
          throw e;
        }
      }
    });
  }

  class NotFoundError extends Error {}

  endpoint<GetWorkspaceRequest, GetWorkspaceResponse>(
    "/workspaces/get",
    async (req) => {
      const workspace = await previewjs.getWorkspace({
        versionCode: `intellij-${version}`,
        logLevel: "info",
        filePath: req.filePath,
      });
      if (!workspace) {
        return {
          workspaceId: null,
        };
      }
      const workspaceId = uuid.v4();
      workspaces[workspaceId] = workspace;
      return {
        workspaceId,
      };
    }
  );

  endpoint<DisposeWorkspaceRequest, DisposeWorkspaceResponse>(
    "/workspaces/dispose",
    async (req) => {
      const workspaceId = req.workspaceId;
      const workspace = workspaces[workspaceId];
      if (!workspace) {
        throw new NotFoundError();
      }
      await workspace.dispose();
      delete workspaces[workspaceId];
      return {};
    }
  );

  endpoint<AnalyzeFileRequest, AnalyzeFileResponse>(
    "/analyze/file",
    async (req) => {
      const workspace = workspaces[req.workspaceId];
      if (!workspace) {
        throw new NotFoundError();
      }
      const components = await workspace.detectComponents(
        req.filePath,
        req.options
      );
      return { components };
    }
  );

  endpoint<StartPreviewRequest, StartPreviewResponse>(
    "/previews/start",
    async (req) => {
      const workspace = workspaces[req.workspaceId];
      if (!workspace) {
        throw new NotFoundError();
      }
      const preview = await workspace.preview.start();
      const previewId = uuid.v4();
      previews[previewId] = preview;
      return {
        previewId,
        url: preview.url(),
      };
    }
  );

  endpoint<StopPreviewRequest, StopPreviewResponse>(
    "/previews/stop",
    async (req) => {
      const previewId = req.previewId;
      const preview = previews[previewId];
      if (!preview) {
        throw new NotFoundError();
      }
      await preview.stop({
        onceUnused: true,
      });
      delete previews[previewId];
      return {};
    }
  );

  endpoint<UpdatePendingFileRequest, UpdatePendingFileResponse>(
    "/pending-files/update",
    async (req) => {
      await previewjs.updateFileInMemory(req.filePath, req.utf8Content);
      return {};
    }
  );

  await new Promise<void>((resolve, reject) => {
    app
      .listen(port, () => {
        resolve();
      })
      .on("error", (e) => {
        reject(e);
      });
  });

  console.log(
    `Preview.js controller API is running on http://localhost:${port}`
  );
}
