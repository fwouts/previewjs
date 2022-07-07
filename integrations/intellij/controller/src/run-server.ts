import type { Preview, Workspace } from "@previewjs/core";
import { load } from "@previewjs/loader";
import express from "express";
import path from "path";
import * as uuid from "uuid";
import type {
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
import { getInstallDir, getPackageNameFromEnvironment } from "./config";

const port = parseInt(process.env.PORT || "9100");
const version = process.env.PREVIEWJS_INTELLIJ_VERSION;

if (!version) {
  throw new Error(`IntelliJ version was not set`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  const previewjs = await load({
    installDir: getInstallDir(),
    packageName: getPackageNameFromEnvironment(),
  });

  const workspaces: Record<string, Workspace> = {};
  const previews: Record<string, Preview> = {};

  const app = express();
  app.use(
    express.json({
      limit: "2mb",
    })
  );
  app.get("/health", (_req, res) => {
    res.json({
      ready: true,
    });
  });

  function endpoint<Request, Response>(
    path: string,
    f: (req: Request) => Promise<Response>
  ) {
    app.post<Record<string, never>, Response, Request>(
      path,
      async (req, res) => {
        try {
          res.json(await f(req.body));
        } catch (e: any) {
          if (e instanceof NotFoundError) {
            console.error(`404 in endpoint ${path}:`);
            console.error(e);
            res.status(404).end(e.message || "Not Found");
          } else {
            console.error(`500 in endpoint ${path}:`);
            console.error(e);
            res.status(500).end(e.message || "Internal Error");
            throw e;
          }
        }
      }
    );
  }

  class NotFoundError extends Error {}

  endpoint<GetWorkspaceRequest, GetWorkspaceResponse>(
    "/workspaces/get",
    async (req) => {
      const workspace = await previewjs.getWorkspace({
        versionCode: `intellij-${version}`,
        logLevel: "info",
        absoluteFilePath: req.absoluteFilePath,
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
    async ({ workspaceId, absoluteFilePath, options }) => {
      const workspace = workspaces[workspaceId];
      if (!workspace) {
        throw new NotFoundError();
      }
      const components = (
        await workspace.frameworkPlugin.detectComponents(
          workspace.typeAnalyzer,
          [absoluteFilePath]
        )
      )
        .map((c) => {
          return c.offsets
            .filter(([start, end]) => {
              if (options?.offset === undefined) {
                return true;
              }
              return options.offset >= start && options.offset <= end;
            })
            .map(([start]) => ({
              componentName: c.name,
              exported: c.exported,
              offset: start,
              componentId: previewjs.core.generateComponentId({
                currentFilePath: path.relative(
                  workspace.rootDirPath,
                  c.absoluteFilePath
                ),
                name: c.name,
              }),
            }));
        })
        .flat();
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
      const preview =
        previews[req.workspaceId] || (await workspace.preview.start());
      previews[req.workspaceId] = preview;
      return {
        url: preview.url(),
      };
    }
  );

  endpoint<StopPreviewRequest, StopPreviewResponse>(
    "/previews/stop",
    async (req) => {
      const preview = previews[req.workspaceId];
      if (!preview) {
        throw new NotFoundError();
      }
      await preview.stop({
        onceUnused: true,
      });
      delete previews[req.workspaceId];
      return {};
    }
  );

  endpoint<UpdatePendingFileRequest, UpdatePendingFileResponse>(
    "/pending-files/update",
    async (req) => {
      await previewjs.updateFileInMemory(req.absoluteFilePath, req.utf8Content);
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
