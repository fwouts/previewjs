import { test } from "@playwright/test";
import type { PreviewServer, Workspace } from "@previewjs/core";
import { createWorkspace, setupFrameworkPlugin } from "@previewjs/core";
import "@previewjs/iframe";
import frameworkPluginFactory from "@previewjs/plugin-react";
import { createFileSystemReader } from "@previewjs/vfs";
import path from "path";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import url from "url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

test.describe("navigation", () => {
  let workspace: Workspace;
  let previewServer: PreviewServer;

  test.beforeAll(async () => {
    // TODO: Simplify syntax drastically.
    const rootDir = path.join(__dirname, "..", "test-app");
    const logger = createLogger(
      { level: "debug" },
      prettyLogger({ colorize: true })
    );
    const reader = createFileSystemReader();
    const frameworkPlugin = await setupFrameworkPlugin({
      rootDir,
      frameworkPlugins: [frameworkPluginFactory],
      logger,
      reader,
    });
    if (!frameworkPlugin) {
      throw new Error(`Unable to initialize framework plugin`);
    }
    workspace = await createWorkspace({
      rootDir,
      frameworkPlugin,
      logger,
      reader,
      onServerStart: () =>
        Promise.resolve({
          middlewares: [
            (req, res, next) => {
              if (req.path === "/") {
                res.end();
              } else {
                next();
              }
            },
          ],
        }),
    });
    previewServer = await workspace.startServer();
  });

  test.afterAll(async () => {
    await previewServer.stop();
    await workspace.dispose();
  });

  test("foo", async ({ page }) => {
    // TODO: Use detected previewable ID.
    const previewableId = "src/App.tsx:App";
    const url = `${previewServer.url()}/preview/${previewableId}/`;
    await page.exposeFunction("onPreviewMessage", () => {
      console.error("HA!");
    });
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    // console.error(url);
    // await new Promise(() => {});
    await page.evaluate(async (previewableId) => {
      // TODO: Pass actual values instead of code, since this is local?
      await window.__PREVIEWJS_IFRAME__.render({
        previewableId,
        autogenCallbackPropsSource: "",
        propsAssignmentSource: "properties = {}",
      });
    }, previewableId);
    await page.screenshot({
      path: "result.png",
    });
  });
});
